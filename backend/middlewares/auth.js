
import jwt from "jsonwebtoken"

// Middleware to verify JWT token
const authToken = (req, res, next) => {
    const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; 
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); // No token

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Invalid token
        req.user = user;
        next();
    });
};

export default authToken