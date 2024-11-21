import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import { addTicket, deleteUserAndSessions, getUserSessions } from "../qlik.mjs";

const BASE_PATH = "/api/auth";

const authRouter = express.Router();

function makeSessionUserId(userdir, user) {
    return `${userdir};${user}`.toLowerCase();
}

authRouter.get("/login/:strategy", async (req, res, next) => {
    const { strategy } = req.params;
    const redirect = req.query.redirect;
    if (!strategy || !redirect) return res.sendStatus(400); // Bad request

    req.session.redirect = redirect;

    passport.authenticate(strategy, {
        // https://developers.google.com/identity/protocols/oauth2/scopes
        scope: ["profile"],
    })(req, res, next);
});

authRouter.get("/logout/:userdir/:user", async (req, res) => {
    const { userdir, user } = req.params;
    const redirect = req.query.redirect;
    if (!userdir || !user || !redirect) return res.sendStatus(400); // Bad request

    if (req.session && req.session.user_id === makeSessionUserId(userdir, user)) {
        req.session = null;
        await deleteUserAndSessions(userdir, user);
    }

    res.redirect(redirect);
});

authRouter.get("/user/:userdir/:user", async (req, res) => {
    const { userdir, user } = req.params;
    if (!userdir || !user) return res.sendStatus(400); // Bad request

    const data = await getUserSessions(userdir, user);

    res.json(data);
});

authRouter.get("/failed", (_, res) => res.sendStatus(401)); // Unauthorized

// https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred
authRouter.get(
    "/google_auth_callback",
    passport.authenticate("google", {
        // https://www.passportjs.org/concepts/authentication/middleware/
        failureRedirect: `${process.env.DOMAIN}${BASE_PATH}/failed`,
        failureMessage: false,
    }),
    async (req, res) => {
        // `provider` is always set to "google".
        // https://github.com/jaredhanson/passport-google-oauth2/blob/79f9ed6/lib/strategy.js#L73
        // https://github.com/jaredhanson/passport-google-oauth2/tree/master/lib/profile
        const { id, displayName, provider, photos } = req.user;
        const user = `${displayName};${id}`;

        await deleteUserAndSessions(provider, user);

        const ticketData = await addTicket(provider, user, [
            { photo: photos && photos.length > 0 ? photos[0].value : null },
            { userName: displayName },
        ]);

        if (!ticketData || !ticketData.Ticket) return res.sendStatus(401); // Unauthorized

        req.session.user_id = makeSessionUserId(provider, user);

        const { Ticket } = ticketData;
        const redirect = req.session.redirect;
        const url = `${redirect}${redirect.indexOf("?") > 0 ? "&" : "?"}qlikTicket=${Ticket}`;

        console.log(`Redirect ${url}`);
        res.redirect(url);
    },
);

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
                callbackURL: `${process.env.DOMAIN}${BASE_PATH}/google_auth_callback`,
                state: true,
            },
            (accessToken, refreshToken, profile, cb) => {
                return cb(null, profile);
            },
        ),
    );

    app.use(BASE_PATH, authRouter);
}
