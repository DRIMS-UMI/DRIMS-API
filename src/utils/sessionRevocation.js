import prisma from './db.mjs';
import { SESSION_TTL_MS } from './sessionConfig.js';

// In-memory cache so authenticateToken does not hit the database on every request.
// Refreshed from the database every minute so multiple server instances converge.
const revokedJtis = new Map();          // jti -> expiresAt (ms)
const userRevokedBefore = new Map();    // userId -> revokedBefore (ms)
let refreshTimer = null;

const refresh = async () => {
    try {
        const rows = await prisma.sessionRevocation.findMany({
            where: { expiresAt: { gt: new Date() } },
        });
        revokedJtis.clear();
        userRevokedBefore.clear();
        for (const row of rows) {
            if (row.jti) revokedJtis.set(row.jti, row.expiresAt.getTime());
            if (row.userId && row.revokedBefore) {
                const ts = row.revokedBefore.getTime();
                userRevokedBefore.set(row.userId, Math.max(ts, userRevokedBefore.get(row.userId) || 0));
            }
        }
    } catch (error) {
        console.error('Failed to refresh session revocations:', error?.message);
    }
};

export const startSessionRevocationSync = async () => {
    await refresh();
    if (!refreshTimer) {
        refreshTimer = setInterval(refresh, 60 * 1000);
        refreshTimer.unref?.();
    }
};

/**
 * @param {{ jti?: string, id?: string, iat?: number }} decoded - verified JWT payload
 */
export const isTokenRevoked = (decoded) => {
    if (decoded?.jti && revokedJtis.has(decoded.jti)) return true;
    const before = decoded?.id && userRevokedBefore.get(decoded.id);
    if (before && decoded.iat && decoded.iat * 1000 < before) return true;
    return false;
};

/** Revoke the single token in use (logout). */
export const revokeToken = async (decoded, reason = 'LOGOUT') => {
    if (!decoded?.jti) return;
    const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + SESSION_TTL_MS.rememberMe);
    revokedJtis.set(decoded.jti, expiresAt.getTime());
    await prisma.sessionRevocation.create({
        data: { jti: decoded.jti, userId: decoded.id, reason, expiresAt },
    });
};

/** Revoke every token issued to a user up to now (deactivation, password reset). */
export const revokeUserSessions = async (userId, reason = 'USER_DEACTIVATED') => {
    if (!userId) return;
    const now = new Date();
    userRevokedBefore.set(userId, now.getTime());
    await prisma.sessionRevocation.create({
        data: {
            userId,
            revokedBefore: now,
            reason,
            expiresAt: new Date(now.getTime() + SESSION_TTL_MS.rememberMe),
        },
    });
};
