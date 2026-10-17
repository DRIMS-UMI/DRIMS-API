import prisma from '../../../utils/db.mjs';

const MAX_RUNS_PER_REQUEST = 200;
const STEP = { ok: 'OK', failed: 'FAILED', skipped: 'SKIPPED', mismatch: 'MISMATCH' };
const ARCHIVE_NAME = /^[\w.-]{1,200}\.archive\.gz$/;

const step = (value, allowed) => {
    const key = String(value ?? 'skipped').toLowerCase();
    return allowed.includes(key) ? STEP[key] : undefined;
};

/** Validates one history.csv-shaped run; returns { data } or { error }. */
const parseRun = (run) => {
    if (!run || typeof run !== 'object') return { error: 'not an object' };
    const performedAt = new Date(run.performedAt);
    if (Number.isNaN(performedAt.getTime())) return { error: 'performedAt must be an ISO 8601 date' };
    if (performedAt > new Date(Date.now() + 5 * 60 * 1000)) return { error: 'performedAt is in the future' };
    if (!ARCHIVE_NAME.test(String(run.archive || ''))) return { error: 'archive must be a *.archive.gz file name' };

    const dump = step(run.dump, ['ok', 'failed']);
    const offsiteStatus = step(run.offsite, ['ok', 'failed', 'skipped']);
    const mirrorStatus = step(run.atlas, ['ok', 'failed', 'skipped']);
    const verifyStatus = step(run.verify, ['ok', 'failed', 'skipped', 'mismatch']);
    if (!dump || !offsiteStatus || !mirrorStatus || !verifyStatus) {
        return { error: 'dump must be ok|failed; offsite/atlas ok|failed|skipped; verify ok|mismatch|failed|skipped' };
    }

    const sizeBytes = Number(run.sizeBytes);
    const duration = Number(run.durationSeconds);
    return {
        data: {
            type: 'SCHEDULED_DUMP',
            status: dump === 'OK' ? 'SUCCESS' : 'FAILED',
            performedAt,
            archiveName: run.archive,
            sizeGb: Number.isFinite(sizeBytes) && sizeBytes > 0 ? Number((sizeBytes / 1024 ** 3).toFixed(4)) : null,
            offsiteStatus,
            mirrorStatus,
            verifyStatus,
            verifyDetails: run.verifyDetails ? String(run.verifyDetails).slice(0, 1000) : null,
            durationSeconds: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null,
            source: 'BACKUP_SCRIPT',
            recordedByName: 'mongodb_backup.sh',
        },
    };
};

/**
 * POST /api/v1/system/backups/ingest  (x-backup-key)
 * Body: { runs: [{ performedAt, archive, sizeBytes, dump, offsite, atlas, verify, verifyDetails, durationSeconds }] }
 * Idempotent per archive name, so history.csv can be re-sent safely (backfill / retries).
 */
export const ingestBackupRuns = async (req, res, next) => {
    try {
        const runs = req.body?.runs;
        if (!Array.isArray(runs) || runs.length === 0 || runs.length > MAX_RUNS_PER_REQUEST) {
            return res.status(400).json({ message: `runs must be an array of 1-${MAX_RUNS_PER_REQUEST} entries` });
        }

        let created = 0;
        let updated = 0;
        const rejected = [];
        for (const [index, run] of runs.entries()) {
            const { data, error } = parseRun(run);
            if (error) {
                rejected.push({ index, archive: run?.archive, reason: error });
                continue;
            }
            const existing = await prisma.backupRecord.findFirst({
                where: { archiveName: data.archiveName, source: 'BACKUP_SCRIPT' },
                select: { id: true },
            });
            if (existing) {
                await prisma.backupRecord.update({ where: { id: existing.id }, data });
                updated += 1;
            } else {
                await prisma.backupRecord.create({ data });
                created += 1;
            }
        }

        res.status(rejected.length && !created && !updated ? 400 : 200).json({
            message: 'Backup runs processed',
            received: runs.length,
            created,
            updated,
            rejected,
        });
    } catch (error) {
        if (!error.statusCode) error.statusCode = 500;
        next(error);
    }
};
