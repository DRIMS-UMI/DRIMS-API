// Middleware to authorize roles
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.sendStatus(403);
        }
        next();
    };
}

export default authorizeRoles; 