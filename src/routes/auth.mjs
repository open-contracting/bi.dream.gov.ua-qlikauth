import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import { deleteUserAndSessions, getTicket, getUserSessions } from "../qlik-utils.mjs";

const WEB_LOGIN = "web_login";
const MODULE_LOGIN = "module_login";
const AUTH_FAILED_URL = `${process.env.DOMAIN}/api/auth/failed`;

const authRouter = express.Router();

authRouter.get("/login/:strategy", async (req, res, next) => {
    const { strategy } = req.params;
    const redirect = req.query.redirect;
    if (!strategy || !redirect) return res.sendStatus(400); // Bad request

    req.session.login_type = WEB_LOGIN;
    req.session.redirect = redirect;

    passport.authenticate(strategy, { failureRedirect: AUTH_FAILED_URL, failureMessage: false })(req, res, next);
});

authRouter.get("/logout/:userdir/:user", async (req, res) => {
    const { userdir, user } = req.params;
    const redirect = req.query.redirect;
    if (!userdir || !user || !redirect) return res.sendStatus(400); // Bad request

    if (req.session && req.session.user_id === `${userdir.toLowerCase()};${user.toLowerCase()}`) {
        req.session = null;
        await deleteUserAndSessions(process.env.QLIK_PROXY_SERVICE, userdir, user);
    }

    res.redirect(redirect);
});

authRouter.get("/user/:userdir/:user", async (req, res) => {
    const { userdir, user } = req.params;
    if (!userdir || !user) return res.sendStatus(400); // Bad request

    const data = await getUserSessions(process.env.QLIK_PROXY_SERVICE, userdir, user);

    res.json(data);
});

// Qlik auth module handler
authRouter.get("/module/:strategy?", async (req, res, next) => {
    const { strategy } = req.params;
    const authStrategy = strategy || "google";
    const { targetId, proxyRestUri } = req.query;

    req.session.login_type = MODULE_LOGIN;
    req.session.targetId = targetId;
    req.session.proxyRestUri = proxyRestUri;

    passport.authenticate(authStrategy, { failureRedirect: AUTH_FAILED_URL, failureMessage: false })(req, res, next);
});

authRouter.get("/failed", (_, res) => res.sendStatus(401)); // Unauthorized

authRouter.get("/google_auth_callback", passport.authenticate("google"), async (req, res, next) => {
    if (req.session.login_type === WEB_LOGIN) {
        req.session.login_type = null;

        const { displayName, id, provider, photos } = req.user;
        const UserId = `${displayName}; id=${id}`;

        if (!UserId) return res.sendStatus(401); // Unauthorized

        await deleteUserAndSessions(process.env.QLIK_PROXY_SERVICE, provider, UserId);

        const ticketData = await getTicket(process.env.QLIK_PROXY_SERVICE, provider, UserId, [
            { photo: photos && photos.length > 0 ? photos[0].value : null },
            { userName: displayName },
        ]);

        if (!ticketData || !ticketData.Ticket) return res.sendStatus(401); // Unauthorized

        req.session.user_id = `${provider.toLowerCase()};${UserId.toLowerCase()}`;

        const { Ticket } = ticketData;
        const redirect = req.session.redirect;

        res.redirect(`${redirect}${redirect.indexOf("?") > 0 ? "&" : "?"}qlikTicket=${Ticket}`);
    }
});

export default function useAuthRouter(app) {
    app.use(passport.initialize());

    passport.serializeUser((user, cb) => {
        process.nextTick(() => cb(null, user));
    });

    passport.deserializeUser((user, cb) => {
        process.nextTick(() => cb(null, user));
    });

    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: `${process.env.DOMAIN}/api/auth/google_auth_callback`,
                scope: ["profile"],
                state: true,
            },
            (accessToken, refreshToken, profile, cb) => {
                return cb(null, profile);
            },
        ),
    );

    app.use("/api/auth", authRouter);
}
