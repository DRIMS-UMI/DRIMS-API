import jwt from 'jsonwebtoken';
import { flagSecurityEvent } from '../../../utils/securityEvents.js';
import { isTokenRevoked } from '../../../utils/sessionRevocation.js';

// Middleware to authenticate user
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        flagSecurityEvent(req, 'UNAUTHENTICATED');
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.AUTH_SECRET, (err, user) => {
        if (err) {
            flagSecurityEvent(req, err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
            return res.sendStatus(401);
        }

        if (isTokenRevoked(user)) {
            req.user = user;
            flagSecurityEvent(req, 'TOKEN_REVOKED');
            return res.sendStatus(401);
        }

        req.user = user;
        next();
    });
}

// Lets the system report identify authenticated routes.
authenticateToken.isAuthentication = true;

export default authenticateToken;
