import { flagSecurityEvent } from '../../../utils/securityEvents.js';

// Middleware to authorize roles
function authorizeRoles(...allowedRoles) {
    const middleware = (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            flagSecurityEvent(req, 'RBAC_DENIED', { allowedRoles });
            return res.sendStatus(403);
        }
        next();
    };
    // Lets the system report build the RBAC route matrix.
    middleware.allowedRoles = allowedRoles;
    return middleware;
}

export default authorizeRoles;
