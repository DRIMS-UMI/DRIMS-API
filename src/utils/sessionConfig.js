import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Single source of truth for session lifetimes. Also read by the system report.
export const SESSION_TTL = {
    default: '24h',
    rememberMe: '7d',
};

export const SESSION_TTL_MS = {
    default: 24 * 60 * 60 * 1000,
    rememberMe: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Sign a session token. Every token gets a unique jti so it can be revoked server-side.
 */
export const signSessionToken = (payload, rememberMe = false) =>
    jwt.sign(payload, process.env.AUTH_SECRET, {
        expiresIn: rememberMe ? SESSION_TTL.rememberMe : SESSION_TTL.default,
        jwtid: crypto.randomUUID(),
    });
