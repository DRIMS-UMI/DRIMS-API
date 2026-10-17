import os from 'os';
import crypto from 'crypto';
import prisma from './db.mjs';

export const HEARTBEAT_INTERVAL_MS = 60 * 1000;

const processStartedAt = new Date();
const instanceId = `${os.hostname()}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
let timer = null;

const beat = () =>
    prisma.systemHeartbeat
        .create({ data: { instanceId, environment: process.env.NODE_ENV || 'development', processStartedAt } })
        .catch((error) => console.error('Heartbeat write failed:', error?.message));

/** Records one heartbeat per minute; the system report derives uptime from gaps. */
export const startHeartbeat = () => {
    if (timer) return;
    beat();
    timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    timer.unref?.();
};

export const getHeartbeatInstance = () => ({ instanceId, processStartedAt });
