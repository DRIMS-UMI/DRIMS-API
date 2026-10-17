import prisma from './db.mjs';

const LOGIN_PATH = /\/login(\/[^/]+)?$/;

const clientIp = (req) =>
    req?.headers['x-client-ip'] || req?.ip || req?.headers['x-forwarded-for'] || null;

/**
 * Mark the current request as a security event. Middleware calls this right before
 * rejecting; the event is persisted once the response finishes.
 */
export const flagSecurityEvent = (req, type, extra = {}) => {
    req.securityEvent = {
        type,
        endpoint: req.route?.path ? `${req.baseUrl}${req.route.path}` : null,
        ...extra,
    };
};

/**
 * App-level middleware: persists flagged events, and classifies failed logins
 * (thrown from the individual login controllers) without touching each controller.
 * Writes are fire-and-forget so a logging failure never affects the response.
 */
export const securityEventRecorder = (req, res, next) => {
    res.on('finish', () => {
        let event = req.securityEvent;
        const path = (req.originalUrl || req.url || '').split('?')[0];

        if (!event && req.method === 'POST' && LOGIN_PATH.test(path) && res.statusCode >= 400 && res.statusCode < 500) {
            event = {
                type: res.statusCode === 429 ? 'RATE_LIMITED' : 'LOGIN_FAILED',
                attemptedEmail: typeof req.body?.email === 'string' ? req.body.email.slice(0, 200) : null,
            };
        }
        if (!event) return;

        prisma.securityEvent.create({
            data: {
                type: event.type,
                method: req.method,
                path: path.slice(0, 500),
                // Router-level guards run before a route matches; fall back to the raw path
                endpoint: event.endpoint || path.slice(0, 500),
                statusCode: res.statusCode,
                userId: req.user?.id || null,
                role: req.user?.role || event.role || null,
                allowedRoles: event.allowedRoles || [],
                attemptedEmail: event.attemptedEmail || null,
                ipAddress: clientIp(req),
                deviceId: req.headers['x-device-id'] || null,
                browserAgent: req.headers['user-agent']?.slice(0, 500) || null,
            },
        }).catch((error) => console.error('Failed to record security event:', error?.message));
    });
    next();
};
