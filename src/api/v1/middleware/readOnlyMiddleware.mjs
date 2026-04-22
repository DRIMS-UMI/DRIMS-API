/**
 * Middleware to restrict AUDITOR role to read-only operations.
 * Blocks non-GET requests for users with the AUDITOR role.
 */
const readOnlyMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'AUDITOR') {
        const allowedMethods = ['GET', 'HEAD', 'OPTIONS'];
        if (!allowedMethods.includes(req.method)) {
            return res.status(403).json({
                message: 'Access Denied: Your role (Auditor) only has read-only permissions.'
            });
        }
    }
    next();
};

export default readOnlyMiddleware;
