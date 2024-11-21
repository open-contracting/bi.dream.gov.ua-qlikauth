import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import { addTicket, deleteUserAndSessions, getUserSessions } from "../qlik.mjs";

const WEB_LOGIN = "web_login";

const authRouter = express.Router();

authRouter.get("/login/:strategy", async (req, res, next) => {
    const { strategy } = req.params;
    const redirect = req.query.redirect;
    if (!strategy || !redirect) return res.sendStatus(400); // Bad request

    req.session.login_type = WEB_LOGIN;
    req.session.redirect = redirect;

    passport.authenticate(strategy, {
        failureRedirect: `${process.env.DOMAIN}/api/auth/failed`,
        failureMessage: false,
    })(req, res, next);
});

authRouter.get("/logout/:userdir/:user", async (req, res) => {
    const { userdir, user } = req.params;
    const redirect = req.query.redirect;
    if (!userdir || !user || !redirect) return res.sendStatus(400); // Bad request

    if (req.session && req.session.user_id === `${userdir};${user}`.toLowerCase()) {
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

authRouter.get("/failed", (_, res) => res.sendStatus(401)); // Unauthorized

authRouter.get("/google_auth_callback", passport.authenticate("google"), async (req, res, next) => {
    if (req.session.login_type === WEB_LOGIN) {
        req.session.login_type = null;

        const { displayName, id, provider, photos } = req.user;
        const UserId = `${displayName};${id}`;

        await deleteUserAndSessions(process.env.QLIK_PROXY_SERVICE, provider, UserId);

        const ticketData = await addTicket(process.env.QLIK_PROXY_SERVICE, provider, UserId, [
            { photo: photos && photos.length > 0 ? photos[0].value : null },
            { userName: displayName },
        ]);

        if (!ticketData || !ticketData.Ticket) return res.sendStatus(401); // Unauthorized

        req.session.user_id = `${provider};${UserId}`.toLowerCase();

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
