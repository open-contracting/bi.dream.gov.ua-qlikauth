import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import { addTicket, deleteUserAndSessions, getUserSessions } from "../qlik.mjs";

const basePath = "/api/auth";

const authRouter = express.Router();

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
    const redirect = req.query.redirect;
    if (!redirect) return res.sendStatus(400); // Bad request

    if (req.session.user) {
        req.session = null; // https://expressjs.com/en/resources/middleware/session.html#unset
        await deleteUserAndSessions(req.session.provider, req.session.user);
    }

    res.redirect(redirect);
});

authRouter.get("/user/:userdir/:user", async (req, res) => {
    res.json(req.session.user ? await getUserSessions(req.session.provider, req.session.user) : []);
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
        // `displayName` can contain a semi-colon.
        // https://myaccount.google.com/profile/name/edit
        // https://developers.google.com/identity/openid-connect/openid-connect#id_token-name
        const user = `${displayName};${id}`;

        await deleteUserAndSessions(provider, user);

        const ticketData = await addTicket(provider, user, [
            { photo: photos && photos.length > 0 ? photos[0].value : null },
            { userName: displayName },
        ]);

        if (!ticketData || !ticketData.Ticket) return res.sendStatus(401); // Unauthorized

        req.session.provider = provider;
        req.session.user = user;

        const redirect = req.authInfo.state.redirect;
        const url = `${redirect}${redirect.indexOf("?") > 0 ? "&" : "?"}qlikTicket=${ticketData.Ticket}`;

        console.log(`Redirect ${url}`);
        res.redirect(url);
    },
);

export default function useAuthRouter(app) {
    app.use(passport.initialize());

    // https://www.passportjs.org/concepts/authentication/sessions/
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
