import axios from 'axios';
import prisma from './db.mjs';

const POLL_INTERVAL_MS = 60 * 1000;
let timer = null;
let lastCoverageHour = null;
let lastState = null; // most recent raw state, for the report's "current status"

export const isUptimeCheckConfigured = () =>
    Boolean(process.env.DO_API_TOKEN && process.env.DO_UPTIME_CHECK_ID);

export const getLastUptimeState = () => lastState;

const recordPoll = (ok, error = null) =>
    prisma.uptimeCheckPoll
        .create({ data: { checkId: process.env.DO_UPTIME_CHECK_ID, ok, error } })
        .catch((e) => console.error('Uptime poll record failed:', e?.message));

/**
 * Poll the DigitalOcean Uptime check state and store its most recent outage.
 * DigitalOcean only exposes `previous_outage`, so polling every minute is what builds the history.
 */
export const pollUptimeCheck = async () => {
    if (!isUptimeCheckConfigured()) return;
    const checkId = process.env.DO_UPTIME_CHECK_ID;
    try {
        const response = await axios.get(`https://api.digitalocean.com/v2/uptime/checks/${checkId}/state`, {
            headers: { Authorization: `Bearer ${process.env.DO_API_TOKEN}` },
            timeout: 15000,
        });
        const state = response.data?.state || {};
        lastState = { ...state, fetchedAt: new Date() };

        const outage = state.previous_outage;
        if (outage?.started_at) {
            const startedAt = new Date(outage.started_at);
            const endedAt = outage.ended_at ? new Date(outage.ended_at) : null;
            const region = outage.region || 'unknown';
            const existing = await prisma.uptimeOutage.findFirst({
                where: { checkId, region, startedAt },
                select: { id: true, endedAt: true },
            });
            const data = {
                endedAt,
                durationSeconds: typeof outage.duration_seconds === 'number' ? outage.duration_seconds : null,
            };
            if (!existing) {
                await prisma.uptimeOutage.create({ data: { source: 'DIGITALOCEAN', checkId, region, startedAt, ...data } });
            } else if (!existing.endedAt && endedAt) {
                await prisma.uptimeOutage.update({ where: { id: existing.id }, data });
            }
        }

        // One coverage row per hour is enough to show the poller was running.
        const hour = new Date().toISOString().slice(0, 13);
        if (hour !== lastCoverageHour) {
            lastCoverageHour = hour;
            await recordPoll(true);
        }
    } catch (error) {
        const message = error.response ? `DigitalOcean API ${error.response.status}` : error.message;
        console.error('Uptime check poll failed:', message);
        await recordPoll(false, String(message).slice(0, 300));
    }
};

export const startUptimeSync = () => {
    if (timer || !isUptimeCheckConfigured()) return;
    pollUptimeCheck();
    timer = setInterval(pollUptimeCheck, POLL_INTERVAL_MS);
    timer.unref?.();
};
