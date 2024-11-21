import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import { addTicket, deleteUserAndSessions, getUserSessions } from "../qlik.mjs";

const basePath = "/api/auth";

const authRouter = express.Router();

function makeSessionUserId(userdir, user) {
    return `${userdir};${user}`.toLowerCase();
}

authRouter.get("/login/google", async (req, res, next) => {
    const redirect = req.query.redirect;
    if (!redirect) return res.sendStatus(400); // Bad request

    passport.authenticate("google", {
        // https://medium.com/passportjs/application-state-in-oauth-2-0-1d94379164e
        state: { redirect: redirect },
        // https://developers.google.com/identity/protocols/oauth2/scopes
        scope: ["profile"],
    })(req, res, next);
});

authRouter.get("/logout/:userdir/:user", async (req, res) => {
    const { userdir, user } = req.params;
    const redirect = req.query.redirect;
    if (!redirect) return res.sendStatus(400); // Bad request

    if (req.session.user_id === makeSessionUserId(userdir, user)) {
        req.session.user_id = null;
        await deleteUserAndSessions(userdir, user);
    }

    res.redirect(redirect);
});

authRouter.get("/user/:userdir/:user", async (req, res) => {
    const { userdir, user } = req.params;

    const data = await getUserSessions(userdir, user);

    res.json(data);
});

authRouter.get("/failed", (_, res) => res.sendStatus(401)); // Unauthorized

// https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred
authRouter.get(
    "/google_auth_callback",
    passport.authenticate("google", {
        // https://www.passportjs.org/concepts/authentication/middleware/
        failureRedirect: `${process.env.DOMAIN}${basePath}/failed`,
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
        const redirect = req.authInfo.state.redirect;
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
                callbackURL: `${process.env.DOMAIN}${basePath}/google_auth_callback`,
                store: true,
            },
            (accessToken, refreshToken, profile, cb) => {
                return cb(null, profile);
            },
        ),
    );

    app.use(basePath, authRouter);
}
