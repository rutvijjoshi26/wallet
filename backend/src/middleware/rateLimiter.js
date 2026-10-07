import rateLimit from "../config/upstash.js";

const rateLimiter = async (req, res, next) => {
    try {
        // Skip rate limiting for health checks
        if (req.path === '/api/health') {
            return next();
        }

        // here we just kept it simple.
        // In real world you might want to use user identifier like user ID or IP address
        const { success } = await rateLimit.limit("my-rate-limit");

        if (!success) {
            return res.status(429).json({ error: "Too many requests, please try again later." });
        }

        next();
    } catch (error) {
        // Fail open: if rate limiting fails, allow the request through
        // This prevents Redis connection issues from blocking all requests
        console.error("Rate limiting error (allowing request):", error);
        next();
    }
};

export default rateLimiter;
