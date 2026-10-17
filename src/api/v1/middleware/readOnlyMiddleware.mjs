import jwt from 'jsonwebtoken';
import { flagSecurityEvent } from '../../../utils/securityEvents.js';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// This guard is mounted with router.use(), i.e. before the route-level authenticateToken,
// so req.user is not populated yet. Decode the bearer token here to read the role;
// invalid/missing tokens are left for authenticateToken to reject.
const resolveRole = (req) => {
    if (req.user) return req.user.role;
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.AUTH_SECRET)?.role ?? null;
    } catch {
        return null;
    }
};

/**
 * Middleware to restrict AUDITOR role to read-only operations.
 * Blocks non-GET requests for users with the AUDITOR role.
 */
const readOnlyMiddleware = (req, res, next) => {
    if (SAFE_METHODS.includes(req.method)) return next();

    if (resolveRole(req) === 'AUDITOR') {
        flagSecurityEvent(req, 'READONLY_BLOCKED', { role: 'AUDITOR' });
        return res.status(403).json({
            message: 'Access Denied: Your role (Auditor) only has read-only permissions.'
        });
    }
    next();
};

readOnlyMiddleware.isReadOnlyGuard = true;

export default readOnlyMiddleware;
