import connectRedis from "connect-redis";
import express from "express";
import session from "express-session";
import Redis from "ioredis";

import useAuthRouter from "./routes/auth.mjs";

async function main() {
    const app = express();

    // https://expressjs.com/en/advanced/best-practice-security.html#reduce-fingerprinting
    app.disable("x-powered-by");
    // https://expressjs.com/en/guide/behind-proxies.html
    app.enable("trust proxy");
    // Parse application/x-www-form-urlencoded, used by Google OAuth 2.0.
    app.use(express.urlencoded({ extended: true }));

    const RedisStore = connectRedis(session);
    const redisClient = new Redis(process.env.REDIS_URL || "redis://redis:6379/0");
    redisClient.on("error", (err) => {
        console.log(`Redis connection failed: ${err}`);
    });
    redisClient.on("connect", () => {
        console.log("Redis connection succeeded");
    });

    app.use(
        // https://expressjs.com/en/resources/middleware/session.html
        session({
            store: new RedisStore({ client: redisClient }),
            secret: process.env.SESSION_SECRET,
            // The defaults will change to false in the future.
            resave: false,
            saveUninitialized: false,
            // Default is { path: '/', httpOnly: true, secure: false, maxAge: null }
            cookie: { secure: true, maxAge: 604800000 }, // 1 week in ms
        }),
    );

    useAuthRouter(app);

    const port = process.env.PORT || 3000;

    app.listen(port, () => {
        console.log(`qlikauth listening on port ${port}`);
    });
}

main();
