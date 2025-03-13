import jwt from 'jsonwebtoken';

// Middleware to authenticate user
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.AUTH_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        console.log(user);
        req.user = user;
        next();
    });
}

export default authenticateToken; 