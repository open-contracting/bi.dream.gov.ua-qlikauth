import connectRedis from "connect-redis";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import Redis from "ioredis";
dotenv.config();

import useAuthRouter from "./routes/auth.mjs";

async function main() {
    const port = process.env.PORT || 3000;

    const app = express();
    app.disable("x-powered-by");
    app.enable("trust proxy");
    app.use(cors());
    // parse application/x-www-form-urlencoded
    app.use(express.urlencoded({ extended: true }));

    // redis session store
    const RedisStore = connectRedis(session);
    //Configure redis client
    const redisClient = new Redis(process.env.REDIS_URL || "redis://redis:6379/0");

    redisClient.on("error", (err) => {
        console.log(`Could not establish a connection with redis. ${err}`);
    });
    redisClient.on("connect", (err) => {
        console.log("Connected to redis successfully");
    });

    app.use(
        session({
            store: new RedisStore({ client: redisClient }),
            resave: false,
            saveUninitialized: false,
            secret: process.env.SESSION_SECRET,
            unset: "destroy",
            // Default is { path: '/', httpOnly: true, secure: false, maxAge: null }
            // https://www.npmjs.com/package/express-session
            cookie: { secure: true },
        }),
    );
    app.get("/ping", (req, res) => res.send("pong"));

    useAuthRouter(app);

    app.listen(port, () => {
        console.log(`qlik auth module listening on port ${port}`);
    });
}

main();
