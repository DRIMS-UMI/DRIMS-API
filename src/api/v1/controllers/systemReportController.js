import prisma from '../../../utils/db.mjs';
import { getMountedRouters } from '../../../utils/routeRegistry.js';
import { SESSION_TTL } from '../../../utils/sessionConfig.js';
import { RATE_LIMITS } from '../../../utils/rateLimits.js';
import { HEARTBEAT_INTERVAL_MS } from '../../../utils/heartbeat.js';
import { isUptimeCheckConfigured, getLastUptimeState } from '../../../utils/uptimeSync.js';

/*
 * System Activity & Status Report.
 *
 * Anything that was not instrumented for (part of) the requested window is reported as
 * NOT_MEASURED rather than PASS. Instrumentation start is the first heartbeat ever
 * written for this environment, since heartbeats and security events shipped together.
 */

const TZ_OFFSET = '+03:00'; // Africa/Kampala, no DST
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_RANGE_DAYS = 366;
const OUTAGE_THRESHOLD_MINUTES = 3; // gaps shorter than this are normal heartbeat jitter
const BRUTE_FORCE_THRESHOLD = 10;   // failed logins from one IP in the window
const BACKUP_MAX_AGE_HOURS = 26;
const RESTORE_TEST_MAX_AGE_DAYS = 90;

// Routes that are intentionally reachable without a token.
const EXPECTED_PUBLIC_ROUTES = [
    /\/login(\/[^/]+)?$/,
    /\/register-superadmin$/,
    /\/request-password-reset$/,
    /\/reset-password$/,
    /^\/api\/v1\/tickets$/, // guest support tickets (rate limited)
    /^\/api\/v1\/tickets\/:id\/messages$/, // guest chat replies; per-ticket access key checked (requireTicketAccess)
];

export const STATUS = { PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL', NOT_MEASURED: 'NOT_MEASURED' };

/* ---------- helpers ---------- */

const num = (v) => {
    if (v == null) return 0;
    if (typeof v === 'object') return Number(v.$numberInt ?? v.$numberLong ?? v.$numberDouble ?? 0);
    return Number(v);
};

const ext = (date) => ({ $date: date.toISOString() });

const dayKey = (date) => new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

const parseRange = (from, to) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(from || '') || !iso.test(to || '')) {
        const error = new Error('from and to are required as YYYY-MM-DD');
        error.statusCode = 400;
        throw error;
    }
    const start = new Date(`${from}T00:00:00${TZ_OFFSET}`);
    const end = new Date(new Date(`${to}T00:00:00${TZ_OFFSET}`).getTime() + DAY_MS); // exclusive
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        const error = new Error('Invalid date range');
        error.statusCode = 400;
        throw error;
    }
    if ((end - start) / DAY_MS > MAX_RANGE_DAYS) {
        const error = new Error(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
        error.statusCode = 400;
        throw error;
    }
    return { start, end };
};

const listDays = (start, end) => {
    const days = [];
    for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) days.push(dayKey(new Date(t)));
    return days;
};

/** Count documents per day (EAT) for a date field, or for the ObjectId timestamp when field is '_id'. */
const dailyCounts = async (model, field, start, end, extraMatch = {}, extraGroup = {}) => {
    const dateExpr = field === '_id' ? { $toDate: '$_id' } : `$${field}`;
    const match = field === '_id'
        ? { $expr: { $and: [{ $gte: [{ $toDate: '$_id' }, ext(start)] }, { $lt: [{ $toDate: '$_id' }, ext(end)] }] }, ...extraMatch }
        : { [field]: { $gte: ext(start), $lt: ext(end) }, ...extraMatch };
    const rows = await model.aggregateRaw({
        pipeline: [
            { $match: match },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: dateExpr, timezone: TZ_OFFSET } },
                    count: { $sum: 1 },
                    ...extraGroup,
                },
            },
        ],
    });
    const byDay = {};
    for (const row of rows) {
        byDay[row._id] = Object.fromEntries(Object.entries(row).filter(([k]) => k !== '_id').map(([k, v]) => [k, num(v)]));
    }
    return byDay;
};

const check = (id, section, label, status, detail) => ({ id, section, label, status, detail });

const oidString = (v) => (v && typeof v === 'object' ? v.$oid ?? null : v ?? null);

/**
 * Count documents grouped by fields. Prisma's groupBy panics on MongoDB when a grouped
 * field is null, so nullable groupings go through aggregateRaw instead.
 * @returns {Promise<Array<Record<string, any> & { count: number }>>}
 */
const groupCount = async (model, match, fields, { sortDesc = false, limit } = {}) => {
    const pipeline = [
        { $match: match },
        { $group: { _id: Object.fromEntries(fields.map((f) => [f, `$${f}`])), count: { $sum: 1 } } },
    ];
    if (sortDesc) pipeline.push({ $sort: { count: -1 } });
    if (limit) pipeline.push({ $limit: limit });
    const rows = await model.aggregateRaw({ pipeline });
    return rows.map((row) => ({
        ...Object.fromEntries(fields.map((f) => [f, oidString(row._id?.[f])])),
        count: num(row.count),
    }));
};

/* ---------- section: availability ---------- */

const buildAvailability = async ({ start, end, now, environment, instrumentationSince }) => {
    const windowEnd = end < now ? end : now;
    if (!instrumentationSince || instrumentationSince >= windowEnd) {
        return {
            status: STATUS.NOT_MEASURED,
            instrumentationSince,
            measuredFrom: null,
            measuredTo: null,
            notMeasuredRanges: [{ from: start, to: end }],
            uptimePercent: null,
            daily: [],
            outages: [],
            restarts: null,
        };
    }

    const measuredFrom = instrumentationSince > start ? instrumentationSince : start;
    const measuredTo = windowEnd;

    // Distinct up-minutes (dedupes multiple instances writing in the same minute).
    const minuteRows = await prisma.systemHeartbeat.aggregateRaw({
        pipeline: [
            { $match: { environment, timestamp: { $gte: ext(measuredFrom), $lt: ext(measuredTo) } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%dT%H:%M', date: '$timestamp' } } } },
            { $sort: { _id: 1 } },
        ],
    });
    const upMinutes = minuteRows.map((r) => new Date(`${r._id}:00.000Z`).getTime());

    const restarts = await prisma.systemHeartbeat.aggregateRaw({
        pipeline: [
            { $match: { environment, timestamp: { $gte: ext(measuredFrom), $lt: ext(measuredTo) } } },
            { $group: { _id: { instanceId: '$instanceId', processStartedAt: '$processStartedAt' } } },
        ],
    });

    const expectedMinutes = Math.max(1, Math.floor((measuredTo - measuredFrom) / MINUTE_MS));
    const uptimePercent = Math.min(100, (upMinutes.length / expectedMinutes) * 100);

    // Outages: gaps between consecutive up-minutes, plus leading/trailing gaps.
    const outages = [];
    const pushGap = (fromMs, toMs) => {
        const minutes = Math.round((toMs - fromMs) / MINUTE_MS);
        if (minutes >= OUTAGE_THRESHOLD_MINUTES) {
            outages.push({ from: new Date(fromMs), to: new Date(toMs), durationMinutes: minutes });
        }
    };
    if (upMinutes.length === 0) {
        pushGap(measuredFrom.getTime(), measuredTo.getTime());
    } else {
        pushGap(measuredFrom.getTime(), upMinutes[0]);
        for (let i = 1; i < upMinutes.length; i++) pushGap(upMinutes[i - 1] + MINUTE_MS, upMinutes[i]);
        pushGap(upMinutes[upMinutes.length - 1] + MINUTE_MS, measuredTo.getTime());
    }

    // Daily uptime, only over the measured part of each day.
    const upByDay = {};
    for (const t of upMinutes) {
        const key = dayKey(new Date(t));
        upByDay[key] = (upByDay[key] || 0) + 1;
    }
    const daily = listDays(start, end).map((day) => {
        const dayStart = new Date(`${day}T00:00:00${TZ_OFFSET}`);
        const dayEnd = new Date(dayStart.getTime() + DAY_MS);
        const from = dayStart > measuredFrom ? dayStart : measuredFrom;
        const to = dayEnd < measuredTo ? dayEnd : measuredTo;
        const expected = Math.floor((to - from) / MINUTE_MS);
        if (expected <= 0) return { day, uptimePercent: null, upMinutes: 0, expectedMinutes: 0, measured: false };
        const up = upByDay[day] || 0;
        return { day, uptimePercent: Math.min(100, (up / expected) * 100), upMinutes: up, expectedMinutes: expected, measured: true };
    });

    const notMeasuredRanges = [];
    if (measuredFrom > start) notMeasuredRanges.push({ from: start, to: measuredFrom });
    if (end > now) notMeasuredRanges.push({ from: now, to: end, reason: 'Future' });

    let status = STATUS.FAIL;
    if (uptimePercent >= 99.5) status = STATUS.PASS;
    else if (uptimePercent >= 95) status = STATUS.WARN;

    return {
        status,
        instrumentationSince,
        heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_MS / 1000,
        measuredFrom,
        measuredTo,
        notMeasuredRanges,
        uptimePercent,
        upMinutes: upMinutes.length,
        expectedMinutes,
        downtimeMinutes: Math.max(0, expectedMinutes - upMinutes.length),
        outages,
        longestOutageMinutes: outages.reduce((m, o) => Math.max(m, o.durationMinutes), 0),
        restarts: Math.max(0, restarts.length - 1),
        daily,
    };
};

/* ---------- section: external uptime (DigitalOcean Uptime check) ---------- */

const overlaps = (a, b) => a.from < b.to && b.from < a.to;

const buildExternalUptime = async ({ start, end, now, internalOutages }) => {
    const configured = isUptimeCheckConfigured();
    const checkId = process.env.DO_UPTIME_CHECK_ID || null;
    const base = { source: 'DigitalOcean Uptime', configured, checkId };
    const firstPoll = checkId
        ? await prisma.uptimeCheckPoll.findFirst({ where: { checkId, ok: true }, orderBy: { timestamp: 'asc' }, select: { timestamp: true } })
        : null;
    const windowEnd = end < now ? end : now;
    if (!firstPoll || firstPoll.timestamp >= windowEnd) {
        return { ...base, status: STATUS.NOT_MEASURED, monitoringSince: firstPoll?.timestamp || null, outages: [] };
    }

    const measuredFrom = firstPoll.timestamp > start ? firstPoll.timestamp : start;
    const measuredTo = windowEnd;
    const [rows, coverageRows, failedPolls] = await Promise.all([
        prisma.uptimeOutage.findMany({
            where: { checkId, startedAt: { lt: measuredTo }, OR: [{ endedAt: null }, { endedAt: { gt: measuredFrom } }] },
            orderBy: { startedAt: 'asc' },
        }),
        prisma.uptimeCheckPoll.aggregateRaw({
            pipeline: [
                { $match: { checkId, ok: true, timestamp: { $gte: ext(measuredFrom), $lt: ext(measuredTo) } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%dT%H', date: '$timestamp' } } } },
            ],
        }),
        prisma.uptimeCheckPoll.count({ where: { checkId, ok: false, timestamp: { gte: measuredFrom, lt: measuredTo } } }),
    ]);

    // Clip to the measured window; an outage with no end is still ongoing.
    const outages = rows.map((o) => {
        const from = o.startedAt < measuredFrom ? measuredFrom : o.startedAt;
        const rawTo = o.endedAt || now;
        const to = rawTo > measuredTo ? measuredTo : rawTo;
        const interval = { from, to };
        return {
            region: o.region,
            from,
            to,
            ongoing: !o.endedAt,
            durationMinutes: Math.max(0, Math.round((to - from) / MINUTE_MS)),
            // Not overlapping any heartbeat outage = the server was up but unreachable from outside (DNS, SSL, proxy, network)
            seenByHeartbeat: (internalOutages || []).some((i) => overlaps(interval, { from: new Date(i.from), to: new Date(i.to) })),
        };
    });

    // Downtime = union of outage intervals across regions
    let downtimeMs = 0;
    let cursor = null;
    for (const o of [...outages].sort((a, b) => a.from - b.from)) {
        if (!cursor || o.from > cursor.to) {
            if (cursor) downtimeMs += cursor.to - cursor.from;
            cursor = { from: o.from, to: o.to };
        } else if (o.to > cursor.to) {
            cursor.to = o.to;
        }
    }
    if (cursor) downtimeMs += cursor.to - cursor.from;

    const windowMs = Math.max(MINUTE_MS, measuredTo - measuredFrom);
    const uptimePercent = Math.max(0, 100 - (downtimeMs / windowMs) * 100);
    const expectedHours = Math.max(1, Math.ceil(windowMs / (60 * MINUTE_MS)));
    let status = STATUS.FAIL;
    if (uptimePercent >= 99.5) status = STATUS.PASS;
    else if (uptimePercent >= 95) status = STATUS.WARN;

    const lastState = getLastUptimeState();
    return {
        ...base,
        status,
        monitoringSince: firstPoll.timestamp,
        measuredFrom,
        measuredTo,
        uptimePercent,
        downtimeMinutes: Math.round(downtimeMs / MINUTE_MS),
        outages,
        outsideOnlyOutages: outages.filter((o) => !o.seenByHeartbeat).length,
        pollCoveragePercent: Math.min(100, (coverageRows.length / expectedHours) * 100),
        failedPolls,
        currentRegions: lastState?.regions || null,
        stateFetchedAt: lastState?.fetchedAt || null,
    };
};

/* ---------- section: platform activity ---------- */

const resolveRoles = async (userIds) => {
    if (userIds.length === 0) return {};
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } });
    return Object.fromEntries(users.map((u) => [u.id, u.role]));
};

const buildActivity = async ({ start, end }) => {
    const range = { gte: start, lt: end };
    const createdIn = { createdAt: { $gte: ext(start), $lt: ext(end) } };
    const days = listDays(start, end);

    const [docDaily, proposalDaily, bookDaily, letterDaily, docsByType, msgDaily, ticketsByStatus, ticketsResolved] = await Promise.all([
        dailyCounts(prisma.studentDocument, 'createdAt', start, end),
        dailyCounts(prisma.proposal, 'submittedAt', start, end),
        dailyCounts(prisma.book, 'submittedAt', start, end),
        dailyCounts(prisma.letterDocument, '_id', start, end),
        groupCount(prisma.studentDocument, createdIn, ['type']),
        dailyCounts(prisma.message, 'createdAt', start, end, {}, {
            read: {
                $sum: {
                    $cond: [{ $gt: [{ $size: { $setDifference: [{ $ifNull: ['$readBy', []] }, ['$senderId']] } }, 0] }, 1, 0],
                },
            },
        }),
        groupCount(prisma.ticket, createdIn, ['status']),
        prisma.ticket.count({ where: { resolvedAt: range } }),
    ]);

    const submissionsDaily = days.map((day) => {
        const row = {
            day,
            studentDocuments: docDaily[day]?.count || 0,
            proposals: proposalDaily[day]?.count || 0,
            books: bookDaily[day]?.count || 0,
            letters: letterDaily[day]?.count || 0,
        };
        row.total = row.studentDocuments + row.proposals + row.books + row.letters;
        return row;
    });
    const sum = (rows, key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0);

    // Direct messages: sender split (students are studentUser ids, staff are user ids).
    const senderRows = await groupCount(prisma.message, createdIn, ['senderId']);
    const senderRoles = await resolveRoles(senderRows.map((r) => r.senderId));
    const sentByRole = {};
    for (const row of senderRows) {
        const role = senderRoles[row.senderId] || 'STUDENT';
        sentByRole[role] = (sentByRole[role] || 0) + row.count;
    }
    const activeConversations = await groupCount(prisma.message, createdIn, ['conversationId']);
    const messagesDaily = days.map((day) => ({
        day,
        sent: msgDaily[day]?.count || 0,
        readByRecipient: msgDaily[day]?.read || 0,
    }));
    const totalSent = sum(messagesDaily, 'sent');
    const totalRead = sum(messagesDaily, 'readByRecipient');

    // Logins (successful logins are recorded in userActivity by every portal).
    const [loginDaily, loginGroups] = await Promise.all([
        dailyCounts(prisma.userActivity, 'timestamp', start, end, { action: 'Login' }),
        groupCount(prisma.userActivity, { action: 'Login', timestamp: { $gte: ext(start), $lt: ext(end) } }, ['userId', 'studentUserId']),
    ]);
    const loginRoles = await resolveRoles(loginGroups.map((g) => g.userId).filter(Boolean));
    const loginsByRole = {};
    const uniqueUsersByRole = {};
    for (const g of loginGroups) {
        const role = g.studentUserId ? 'STUDENT' : (loginRoles[g.userId] || 'UNKNOWN');
        loginsByRole[role] = (loginsByRole[role] || 0) + g.count;
        uniqueUsersByRole[role] = (uniqueUsersByRole[role] || 0) + 1;
    }

    return {
        submissions: {
            total: sum(submissionsDaily, 'total'),
            studentDocuments: sum(submissionsDaily, 'studentDocuments'),
            proposals: sum(submissionsDaily, 'proposals'),
            books: sum(submissionsDaily, 'books'),
            letters: sum(submissionsDaily, 'letters'),
            studentDocumentsByType: docsByType.map((r) => ({ type: r.type, count: r.count })),
            daily: submissionsDaily,
        },
        messages: {
            sent: totalSent,
            readByRecipient: totalRead,
            unread: totalSent - totalRead,
            readRatePercent: totalSent ? (totalRead / totalSent) * 100 : null,
            activeConversations: activeConversations.length,
            sentByRole: Object.entries(sentByRole).map(([role, count]) => ({ role, count })),
            daily: messagesDaily,
        },
        logins: {
            total: loginGroups.reduce((acc, g) => acc + g.count, 0),
            uniqueUsers: loginGroups.length,
            byRole: Object.keys(loginsByRole).map((role) => ({ role, logins: loginsByRole[role], uniqueUsers: uniqueUsersByRole[role] })),
            daily: days.map((day) => ({ day, logins: loginDaily[day]?.count || 0 })),
        },
        tickets: {
            created: ticketsByStatus.reduce((acc, r) => acc + r.count, 0),
            resolved: ticketsResolved,
            byStatus: ticketsByStatus.map((r) => ({ status: r.status, count: r.count })),
        },
    };
};

/* ---------- section: users ---------- */

/**
 * Account counts. Totals are as at report generation (accounts are not versioned);
 * "new" counts are accounts created inside the period. isActive missing = active (schema default).
 */
const buildUsers = async ({ start, end }) => {
    const inPeriod = { createdAt: { $gte: ext(start), $lt: ext(end) } };
    const [staffRows, staffNewRows, studentRows, studentNew] = await Promise.all([
        groupCount(prisma.user, {}, ['role', 'isActive']),
        groupCount(prisma.user, inPeriod, ['role']),
        groupCount(prisma.studentUser, {}, ['isActive']),
        prisma.studentUser.count({ where: { createdAt: { gte: start, lt: end } } }),
    ]);

    const byRole = {};
    const ensure = (role) => (byRole[role] ||= { role, total: 0, active: 0, deactivated: 0, newInPeriod: 0 });
    for (const row of staffRows) {
        const entry = ensure(row.role || 'UNKNOWN');
        entry.total += row.count;
        if (row.isActive === false) entry.deactivated += row.count;
        else entry.active += row.count;
    }
    for (const row of staffNewRows) ensure(row.role || 'UNKNOWN').newInPeriod += row.count;

    const students = ensure('STUDENT');
    for (const row of studentRows) {
        students.total += row.count;
        if (row.isActive === false) students.deactivated += row.count;
        else students.active += row.count;
    }
    students.newInPeriod += studentNew;

    const roles = Object.values(byRole).sort((a, b) => b.total - a.total);
    const sum = (key, filter = () => true) => roles.filter(filter).reduce((acc, r) => acc + r[key], 0);
    const isStudent = (r) => r.role === 'STUDENT';
    return {
        asOf: new Date(),
        total: sum('total'),
        active: sum('active'),
        deactivated: sum('deactivated'),
        newInPeriod: sum('newInPeriod'),
        students: { total: students.total, active: students.active, deactivated: students.deactivated, newInPeriod: students.newInPeriod },
        staff: {
            total: sum('total', (r) => !isStudent(r)),
            active: sum('active', (r) => !isStudent(r)),
            deactivated: sum('deactivated', (r) => !isStudent(r)),
            newInPeriod: sum('newInPeriod', (r) => !isStudent(r)),
        },
        byRole: roles,
    };
};

/* ---------- section: RBAC ---------- */

const routePaths = (route) => (Array.isArray(route.path) ? route.path : [route.path]).map(String);

/** Walk the mounted routers and describe every endpoint's auth/role requirements. */
export const buildRbacMatrix = () => {
    const routes = [];
    for (const { path: base, router } of getMountedRouters()) {
        const routerLevel = [];
        for (const layer of router.stack) {
            if (!layer.route) {
                if (layer.name !== 'router') routerLevel.push(layer.handle);
                continue;
            }
            const handles = [...routerLevel, ...layer.route.stack.map((l) => l.handle)];
            const machineAuth = handles.some((h) => h.isMachineAuthentication);
            const authenticated = machineAuth || handles.some((h) => h.isAuthentication);
            const roleSets = handles.filter((h) => Array.isArray(h.allowedRoles)).map((h) => h.allowedRoles);
            const roles = roleSets.length
                ? roleSets.reduce((acc, set) => acc.filter((r) => set.includes(r)))
                : null;
            const methods = Object.keys(layer.route.methods).filter((m) => m !== '_all').map((m) => m.toUpperCase());
            for (const p of routePaths(layer.route)) {
                const fullPath = `${base}${p === '/' ? '' : p}` || base;
                for (const method of methods) {
                    const expectedPublic = !authenticated && EXPECTED_PUBLIC_ROUTES.some((re) => re.test(fullPath));
                    routes.push({
                        method,
                        path: fullPath,
                        authenticated,
                        roles,
                        readOnlyGuard: handles.some((h) => h.isReadOnlyGuard),
                        access: !authenticated
                            ? (expectedPublic ? 'PUBLIC_EXPECTED' : 'PUBLIC_UNEXPECTED')
                            : roles ? 'ROLE_RESTRICTED'
                            : machineAuth ? 'MACHINE_KEY'
                            : handles.some((h) => h.isSelfService) ? 'SELF_SERVICE'
                            : 'ANY_AUTHENTICATED',
                    });
                }
            }
        }
    }
    routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
    const count = (access) => routes.filter((r) => r.access === access).length;
    return {
        totalRoutes: routes.length,
        roleRestricted: count('ROLE_RESTRICTED'),
        selfService: count('SELF_SERVICE'),
        machineKey: count('MACHINE_KEY'),
        anyAuthenticated: count('ANY_AUTHENTICATED'),
        publicExpected: count('PUBLIC_EXPECTED'),
        publicUnexpected: count('PUBLIC_UNEXPECTED'),
        routes,
    };
};

/* ---------- section: security events & sessions ---------- */

const buildSecurity = async ({ start, end, now, instrumentationSince }) => {
    const measured = instrumentationSince && instrumentationSince < (end < now ? end : now);
    const measuredFrom = measured ? (instrumentationSince > start ? instrumentationSince : start) : null;
    const range = { gte: start, lt: end };

    const inWindow = { timestamp: { $gte: ext(start), $lt: ext(end) } };
    const [byType, byEndpoint, failedByIp, rbacByRole, daily, logouts, deactivationRevocations] = await Promise.all([
        groupCount(prisma.securityEvent, inWindow, ['type']),
        groupCount(prisma.securityEvent,
            { ...inWindow, type: { $in: ['RBAC_DENIED', 'READONLY_BLOCKED', 'UNAUTHENTICATED', 'INVALID_TOKEN', 'TOKEN_REVOKED'] } },
            ['type', 'method', 'endpoint'], { sortDesc: true, limit: 25 }),
        groupCount(prisma.securityEvent, { ...inWindow, type: 'LOGIN_FAILED' }, ['ipAddress'], { sortDesc: true, limit: 10 }),
        groupCount(prisma.securityEvent, { ...inWindow, type: { $in: ['RBAC_DENIED', 'READONLY_BLOCKED'] } }, ['role']),
        dailyCounts(prisma.securityEvent, 'timestamp', start, end, {}, {
            denied: { $sum: { $cond: [{ $in: ['$type', ['RBAC_DENIED', 'READONLY_BLOCKED']] }, 1, 0] } },
            unauthenticated: { $sum: { $cond: [{ $in: ['$type', ['UNAUTHENTICATED', 'INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_REVOKED']] }, 1, 0] } },
            failedLogins: { $sum: { $cond: [{ $eq: ['$type', 'LOGIN_FAILED'] }, 1, 0] } },
            rateLimited: { $sum: { $cond: [{ $eq: ['$type', 'RATE_LIMITED'] }, 1, 0] } },
        }),
        prisma.sessionRevocation.count({ where: { reason: 'LOGOUT', createdAt: range } }),
        prisma.sessionRevocation.count({ where: { reason: 'USER_DEACTIVATED', createdAt: range } }),
    ]);

    // Login anomaly: accounts that logged in from many distinct IPs in the window.
    const multiIp = await prisma.userActivity.aggregateRaw({
        pipeline: [
            { $match: { action: 'Login', timestamp: { $gte: ext(start), $lt: ext(end) } } },
            { $group: { _id: { $ifNull: ['$userId', '$studentUserId'] }, ips: { $addToSet: '$ipAddress' }, logins: { $sum: 1 } } },
            { $project: { ipCount: { $size: '$ips' }, logins: 1 } },
            { $match: { ipCount: { $gte: 5 } } },
            { $sort: { ipCount: -1 } },
            { $limit: 10 },
        ],
    });

    const totals = Object.fromEntries(byType.map((r) => [r.type, r.count]));
    const bruteForceIps = failedByIp
        .filter((r) => r.count >= BRUTE_FORCE_THRESHOLD)
        .map((r) => ({ ipAddress: r.ipAddress || 'Unknown', failedLogins: r.count }));

    return {
        measured: Boolean(measured),
        measuredFrom,
        instrumentationSince,
        totals,
        deniedByEndpoint: byEndpoint.map((r) => ({ type: r.type, method: r.method, endpoint: r.endpoint || '(unmatched)', count: r.count })),
        deniedByRole: rbacByRole.map((r) => ({ role: r.role || 'UNKNOWN', count: r.count })),
        failedLoginsByIp: failedByIp.map((r) => ({ ipAddress: r.ipAddress || 'Unknown', failedLogins: r.count })),
        bruteForceIps,
        multiIpAccounts: multiIp.map((r) => ({ accountId: oidString(r._id), distinctIps: num(r.ipCount), logins: num(r.logins) })),
        daily: listDays(start, end).map((day) => ({
            day,
            denied: daily[day]?.denied || 0,
            unauthenticated: daily[day]?.unauthenticated || 0,
            failedLogins: daily[day]?.failedLogins || 0,
            rateLimited: daily[day]?.rateLimited || 0,
        })),
        session: {
            tokenLifetime: SESSION_TTL.default,
            rememberMeLifetime: SESSION_TTL.rememberMe,
            serverSideRevocation: true,
            rateLimits: RATE_LIMITS,
            logouts,
            deactivationRevocations,
        },
    };
};

/* ---------- section: backups & integrity ---------- */

const DUMP_TYPES = ['SCHEDULED_DUMP', 'MANUAL_EXPORT', 'SNAPSHOT'];
const hoursSince = (now, date) => (date ? (now - date) / (60 * 60 * 1000) : null);

/**
 * Recovery evidence = the most recent of: a manual restore test, or a scheduled run that
 * restored the dump into the Atlas mirror (and ideally verified its document counts).
 */
const restoreEvidence = (now, manual, mirrored) => {
    const pick = [manual, mirrored].filter(Boolean).sort((a, b) => b.performedAt - a.performedAt)[0];
    if (!pick) return null;
    const ageDays = (now - pick.performedAt) / DAY_MS;
    const fresh = ageDays <= RESTORE_TEST_MAX_AGE_DAYS;
    if (pick.type === 'RESTORE_TEST') {
        return {
            kind: 'RESTORE_TEST', record: pick, ageDays,
            status: pick.status !== 'SUCCESS' ? STATUS.FAIL : fresh ? STATUS.PASS : STATUS.WARN,
            detail: `Manual restore test ${pick.status.toLowerCase()} ${Math.round(ageDays)} day(s) ago.`,
        };
    }
    if (pick.mirrorStatus === 'FAILED') {
        return { kind: 'ATLAS_MIRROR', record: pick, ageDays, status: STATUS.FAIL, detail: `Restoring the ${fmtDay(pick.performedAt)} dump into the Atlas mirror failed.` };
    }
    const verify = {
        OK: [fresh ? STATUS.PASS : STATUS.WARN, 'restored into Atlas and every collection\'s document count matched the dump'],
        MISMATCH: [STATUS.FAIL, `restored into Atlas but document counts differ from the dump (${pick.verifyDetails || 'see backup log'})`],
        FAILED: [STATUS.WARN, 'restored into Atlas, but the document-count check could not run'],
    }[pick.verifyStatus] || [STATUS.WARN, 'restored into Atlas, but the contents were not verified'];
    return { kind: 'ATLAS_MIRROR', record: pick, ageDays, status: verify[0], detail: `Latest backup (${fmtDay(pick.performedAt)}) ${verify[1]}.` };
};

const fmtDay = (date) => dayKey(date);

const buildBackups = async ({ start, end, now }) => {
    const [records, latestBackup, latestOffsite, latestScriptRun, latestManualRestore, latestMirrored] = await Promise.all([
        prisma.backupRecord.findMany({ where: { performedAt: { gte: start, lt: end } }, orderBy: { performedAt: 'desc' } }),
        prisma.backupRecord.findFirst({ where: { type: { in: DUMP_TYPES }, status: 'SUCCESS' }, orderBy: { performedAt: 'desc' } }),
        prisma.backupRecord.findFirst({ where: { offsiteStatus: 'OK' }, orderBy: { performedAt: 'desc' } }),
        prisma.backupRecord.findFirst({ where: { source: 'BACKUP_SCRIPT' }, orderBy: { performedAt: 'desc' } }),
        prisma.backupRecord.findFirst({ where: { type: 'RESTORE_TEST' }, orderBy: { performedAt: 'desc' } }),
        prisma.backupRecord.findFirst({ where: { source: 'BACKUP_SCRIPT', mirrorStatus: { in: ['OK', 'FAILED'] } }, orderBy: { performedAt: 'desc' } }),
    ]);

    const dumps = records.filter((r) => DUMP_TYPES.includes(r.type));
    const backupDays = new Set(dumps.filter((r) => r.status === 'SUCCESS').map((r) => dayKey(r.performedAt)));
    const offsiteDays = new Set(dumps.filter((r) => r.offsiteStatus === 'OK').map((r) => dayKey(r.performedAt)));
    const pastDays = listDays(start, end < now ? end : now);
    const scriptRuns = records.filter((r) => r.source === 'BACKUP_SCRIPT');
    const runFailed = (r) => r.status === 'FAILED' || [r.offsiteStatus, r.mirrorStatus, r.verifyStatus].some((x) => x === 'FAILED' || x === 'MISMATCH');

    return {
        provider: 'Self-hosted MongoDB on the DigitalOcean droplet (mongodb_backup.sh: local archive, off-site copy, Atlas mirror)',
        scriptReporting: Boolean(latestScriptRun),
        latestScriptRunAt: latestScriptRun?.performedAt || null,
        records,
        runsInWindow: scriptRuns.length,
        runsWithProblems: scriptRuns.filter(runFailed).length,
        daysWithBackup: backupDays.size,
        daysWithOffsite: offsiteDays.size,
        daysInWindow: pastDays.length,
        daysMissingBackup: pastDays.filter((d) => !backupDays.has(d)),
        latestBackup,
        latestBackupAgeHours: hoursSince(now, latestBackup?.performedAt),
        latestOffsite,
        latestOffsiteAgeHours: hoursSince(now, latestOffsite?.performedAt),
        offsiteConfigured: latestScriptRun ? latestScriptRun.offsiteStatus !== 'SKIPPED' : null,
        restore: restoreEvidence(now, latestManualRestore, latestMirrored),
    };
};

const buildIntegrity = async () => {
    const missing = { $in: [null] }; // matches null and absent fields
    const [docsWithoutContent, lettersWithoutContent] = await Promise.all([
        prisma.studentDocument.aggregateRaw({
            pipeline: [{ $match: { fileGridFSId: missing, fileData: missing } }, { $count: 'n' }],
        }),
        prisma.letterDocument.aggregateRaw({
            pipeline: [{ $match: { fileGridFSId: missing, file: missing } }, { $count: 'n' }],
        }),
    ]);
    return {
        studentDocumentsWithoutContent: num(docsWithoutContent[0]?.n),
        lettersWithoutContent: num(lettersWithoutContent[0]?.n),
    };
};

/* ---------- checks & findings ---------- */

const buildChecks = ({ availability, external, security, rbac, backups, integrity }) => {
    const checks = [];
    const fmt = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d));

    checks.push(check('uptime', 'availability', 'Service uptime', availability.status,
        availability.status === STATUS.NOT_MEASURED
            ? 'Heartbeat monitoring was not active during this window.'
            : `${fmt(availability.uptimePercent)}% over the measured period; ${availability.outages.length} outage(s), longest ${availability.longestOutageMinutes} min.`));

    checks.push(check('rbac-routes', 'security', 'All non-public endpoints require authentication',
        rbac.publicUnexpected === 0 ? STATUS.PASS : STATUS.FAIL,
        `${rbac.totalRoutes} routes inspected; ${rbac.publicUnexpected} unexpectedly public.`));

    checks.push(check('rbac-roles', 'security', 'Authenticated endpoints are role-restricted',
        rbac.anyAuthenticated === 0 ? STATUS.PASS : STATUS.WARN,
        `${rbac.roleRestricted} role-restricted, ${rbac.selfService} own-account (any role, by design), ${rbac.anyAuthenticated} open to any signed-in role without a stated reason.`));

    const denied = (security.totals.RBAC_DENIED || 0) + (security.totals.READONLY_BLOCKED || 0);
    checks.push(check('rbac-enforced', 'security', 'Unauthorized requests were blocked',
        security.measured ? STATUS.PASS : STATUS.NOT_MEASURED,
        security.measured
            ? `${denied} role-denied and ${security.totals.UNAUTHENTICATED || 0} unauthenticated requests were rejected (403/401).`
            : 'Access-denial logging was not active during this window.'));

    checks.push(check('brute-force', 'security', 'No brute-force login activity',
        !security.measured ? STATUS.NOT_MEASURED : security.bruteForceIps.length === 0 ? STATUS.PASS : STATUS.WARN,
        !security.measured
            ? 'Failed-login logging was not active during this window.'
            : `${security.totals.LOGIN_FAILED || 0} failed logins; ${security.bruteForceIps.length} IP(s) with ≥${BRUTE_FORCE_THRESHOLD} failures.`));

    checks.push(check('session-config', 'security', 'Session tokens expire and can be revoked', STATUS.PASS,
        `Tokens expire after ${security.session.tokenLifetime} (${security.session.rememberMeLifetime} with "remember me"); logout and deactivation revoke tokens server-side; login attempts rate limited.`));

    checks.push(check('external-uptime', 'availability', 'Reachable from outside (DigitalOcean Uptime)', external.status,
        external.status === STATUS.NOT_MEASURED
            ? (external.configured ? 'The DigitalOcean Uptime check had not been polled during this window.' : 'Not configured: set DO_API_TOKEN and DO_UPTIME_CHECK_ID on the server.')
            : `${fmt(external.uptimePercent)}% reachable; ${external.outages.length} outage(s) seen from outside, ${external.outsideOnlyOutages} of them while the server itself was running.`));

    let backupStatus = STATUS.NOT_MEASURED;
    let backupDetail = 'No backup records. Set BACKUP_INGEST_KEY on the server and in ~/.mongo_backup.env, then run mongodb_backup.sh --sync.';
    if (backups.latestBackup) {
        backupStatus = backups.latestBackupAgeHours <= BACKUP_MAX_AGE_HOURS ? STATUS.PASS : STATUS.FAIL;
        backupDetail = `Latest successful backup ${fmt(backups.latestBackupAgeHours, 1)} h ago; ${backups.daysWithBackup}/${backups.daysInWindow} days in the period have one.`;
    }
    checks.push(check('backup-recent', 'backups', `Recent successful backup (within ${BACKUP_MAX_AGE_HOURS} h)`, backupStatus, backupDetail));

    let offsiteStatus = STATUS.NOT_MEASURED;
    let offsiteDetail = 'No backup runs reported by mongodb_backup.sh yet.';
    if (backups.offsiteConfigured === false) {
        offsiteStatus = STATUS.WARN;
        offsiteDetail = 'Off-site copy is not configured (OFFSITE_TARGET empty): losing the droplet would lose its local backups.';
    } else if (backups.latestOffsite) {
        offsiteStatus = backups.latestOffsiteAgeHours <= BACKUP_MAX_AGE_HOURS ? STATUS.PASS : STATUS.FAIL;
        offsiteDetail = `Latest off-site copy ${fmt(backups.latestOffsiteAgeHours, 1)} h ago; ${backups.daysWithOffsite}/${backups.daysInWindow} days in the period have one.`;
    } else if (backups.scriptReporting) {
        offsiteStatus = STATUS.FAIL;
        offsiteDetail = 'Off-site copy is configured but has never succeeded.';
    }
    checks.push(check('backup-offsite', 'backups', `Off-site copy (within ${BACKUP_MAX_AGE_HOURS} h)`, offsiteStatus, offsiteDetail));

    checks.push(check('restore-test', 'backups', `Recovery verified (within ${RESTORE_TEST_MAX_AGE_DAYS} days)`,
        backups.restore?.status || STATUS.NOT_MEASURED,
        backups.restore?.detail || 'No restore evidence: the Atlas mirror has not run and no manual restore test is recorded.'));

    const orphaned = integrity.studentDocumentsWithoutContent + integrity.lettersWithoutContent;
    checks.push(check('file-integrity', 'integrity', 'Every uploaded document has stored file content',
        orphaned === 0 ? STATUS.PASS : STATUS.WARN,
        `${integrity.studentDocumentsWithoutContent} student document(s) and ${integrity.lettersWithoutContent} letter(s) have no stored file.`));

    return checks;
};

const buildFindings = ({ checks, rbac, security }) => {
    const findings = [];
    const unexpected = rbac.routes.filter((r) => r.access === 'PUBLIC_UNEXPECTED');
    if (unexpected.length) {
        findings.push({
            severity: 'HIGH',
            title: 'Endpoints reachable without authentication',
            detail: unexpected.map((r) => `${r.method} ${r.path}`).join(', '),
        });
    }
    if (rbac.anyAuthenticated) {
        findings.push({
            severity: 'LOW',
            title: 'Endpoints open to any signed-in role',
            detail: `${rbac.anyAuthenticated} endpoint(s) require a token but no specific role and are not marked as own-account (selfService). See the RBAC matrix (access = ANY_AUTHENTICATED).`,
        });
    }
    if (security.bruteForceIps.length) {
        findings.push({
            severity: 'MEDIUM',
            title: 'Possible brute-force login attempts',
            detail: security.bruteForceIps.map((r) => `${r.ipAddress} (${r.failedLogins})`).join(', '),
        });
    }
    if (security.multiIpAccounts.length) {
        findings.push({
            severity: 'INFO',
            title: 'Accounts signing in from many IP addresses',
            detail: `${security.multiIpAccounts.length} account(s) logged in from 5+ distinct IPs. Often mobile networks; review if unexpected.`,
        });
    }
    for (const c of checks) {
        if (c.status === STATUS.FAIL && !['rbac-routes'].includes(c.id)) {
            findings.push({ severity: 'HIGH', title: c.label, detail: c.detail });
        } else if (c.status === STATUS.NOT_MEASURED) {
            findings.push({ severity: 'INFO', title: `${c.label}: not measured`, detail: c.detail });
        }
    }
    return findings;
};

/* ---------- controllers ---------- */

export const getSystemReport = async (req, res, next) => {
    try {
        const { start, end } = parseRange(req.query.from, req.query.to);
        const now = new Date();
        const environment = process.env.NODE_ENV || 'development';

        const firstHeartbeat = await prisma.systemHeartbeat.findFirst({
            where: { environment },
            orderBy: { timestamp: 'asc' },
            select: { timestamp: true },
        });
        const instrumentationSince = firstHeartbeat?.timestamp || null;
        const ctx = { start, end, now, environment, instrumentationSince };

        const [availability, activity, users, security, backups, integrity] = await Promise.all([
            buildAvailability(ctx),
            buildActivity(ctx),
            buildUsers(ctx),
            buildSecurity(ctx),
            buildBackups(ctx),
            buildIntegrity(),
        ]);
        const external = await buildExternalUptime({ ...ctx, internalOutages: availability.outages });
        availability.external = external;
        const rbac = buildRbacMatrix();
        const checks = buildChecks({ availability, external, security, rbac, backups, integrity });
        const findings = buildFindings({ checks, rbac, security });

        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: 'Generated System Report',
                entityType: 'SystemReport',
                entityId: req.user.id,
                details: JSON.stringify({ from: req.query.from, to: req.query.to }),
                ipAddress: req.headers['x-client-ip'] || req.ip || 'Unknown',
                deviceId: req.headers['x-device-id'] || 'Unknown',
                browserAgent: req.headers['user-agent'] || 'Unknown',
            },
        });

        res.status(200).json({
            message: 'System report generated successfully',
            report: {
                meta: {
                    from: req.query.from,
                    to: req.query.to,
                    timezone: 'Africa/Kampala (UTC+03:00)',
                    environment,
                    generatedAt: now,
                    generatedBy: { id: req.user.id, name: req.user.name, role: req.user.role },
                    instrumentationSince,
                },
                checks,
                findings,
                availability,
                activity,
                users,
                security,
                rbac,
                backups,
                integrity,
            },
        });
    } catch (error) {
        if (!error.statusCode) {
            console.error('Error generating system report:', error);
            error.statusCode = 500;
        }
        next(error);
    }
};

const BACKUP_TYPES = ['MANUAL_EXPORT', 'RESTORE_TEST'];
const BACKUP_STATUSES = ['SUCCESS', 'FAILED'];

export const createBackupRecord = async (req, res, next) => {
    try {
        const { type, status, performedAt, sizeGb, notes } = req.body;
        const performed = new Date(performedAt);
        if (!BACKUP_TYPES.includes(type) || !BACKUP_STATUSES.includes(status) || Number.isNaN(performed.getTime())) {
            const error = new Error(`type (${BACKUP_TYPES.join('/')}), status (${BACKUP_STATUSES.join('/')}) and a valid performedAt are required`);
            error.statusCode = 400;
            throw error;
        }
        if (performed > new Date()) {
            const error = new Error('performedAt cannot be in the future');
            error.statusCode = 400;
            throw error;
        }

        const record = await prisma.backupRecord.create({
            data: {
                source: 'MANUAL',
                type,
                status,
                performedAt: performed,
                sizeGb: sizeGb === undefined || sizeGb === '' || sizeGb === null ? null : Number(sizeGb),
                notes: notes ? String(notes).slice(0, 2000) : null,
                recordedById: req.user.id,
                recordedByName: req.user.name,
            },
        });

        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: 'Recorded Backup Verification',
                entityType: 'BackupRecord',
                entityId: record.id,
                details: JSON.stringify({ type, status, performedAt: performed.toISOString() }),
                ipAddress: req.headers['x-client-ip'] || req.ip || 'Unknown',
                deviceId: req.headers['x-device-id'] || 'Unknown',
                browserAgent: req.headers['user-agent'] || 'Unknown',
            },
        });

        res.status(201).json({ message: 'Backup record saved', record });
    } catch (error) {
        if (!error.statusCode) error.statusCode = 500;
        next(error);
    }
};
