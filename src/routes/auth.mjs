import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import { addTicket, deleteUserAndSessions, getUserSessions } from "../qlik.mjs";

const baseUrl = process.env.BASE_URL || "/api/auth";

const authRouter = express.Router();

function hasRedirect(req, res, next) {
    if (req.query.redirect) next();
    else res.sendStatus(400); // Bad request
}

authRouter.get(
    "/login/google",
    hasRedirect,
    passport.authenticate("google", {
        // https://medium.com/passportjs/application-state-in-oauth-2-0-1d94379164e
        state: { redirect: redirect },
        // https://developers.google.com/identity/protocols/oauth2/scopes
        scope: ["profile"],
    }),
);

authRouter.get("/logout/:userdir/:user", hasRedirect, async (req, res) => {
    if (req.session.user) {
        await deleteUserAndSessions(req.session.provider, req.session.user);
    }

    req.session.provider = null;
    req.session.user = null;

    req.session.save((err) => {
        if (err) next(err);

        req.session.regenerate((err) => {
            if (err) next(err);

            res.redirect(redirect);
        });
    });
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
        failureRedirect: `${baseUrl}/failed`,
        failureMessage: false,
    }),
    async (req, res, next) => {
        // `provider` is always set to "google".
        // https://github.com/jaredhanson/passport-google-oauth2/blob/79f9ed6/lib/strategy.js#L73
        // https://github.com/jaredhanson/passport-google-oauth2/tree/master/lib/profile
        const { id, displayName, provider, photos } = req.user;
        // `displayName` can contain characters that need to be URL-encoded.
        // https://myaccount.google.com/profile/name/edit
        // https://developers.google.com/identity/openid-connect/openid-connect#id_token-name
        const user = `${displayName};${id}`;

        await deleteUserAndSessions(provider, user);

        // https://community.qlik.com/t5/Design/Tickets-in-Qlik-Sense/ba-p/1475770
        const ticket = await addTicket(provider, user, [
            { photo: photos && photos.length > 0 ? photos[0].value : null },
            { userName: displayName },
        ]);

        if (!ticket) return res.sendStatus(401); // Unauthorized

        const redirect = req.authInfo.state.redirect;
        const url = `${redirect}${redirect.indexOf("?") > 0 ? "&" : "?"}qlikTicket=${ticket}`;

        req.session.regenerate((err) => {
            if (err) next(err);

            req.session.provider = provider;
            req.session.user = user;

            req.session.save((err) => {
                if (err) return next(err);

                // console.log(`Redirect ${url}`);
                res.redirect(url);
            });
        });
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
                // https://github.com/jaredhanson/passport-oauth2/blob/be9bf58/lib/strategy.js#L148
                // https://github.com/jaredhanson/passport-oauth2/blob/master/lib/utils.js
                callbackURL: `${baseUrl}/google_auth_callback`,
                store: true,
            },
            (accessToken, refreshToken, profile, cb) => {
                return cb(null, profile);
            },
        ),
    );

    app.use(baseUrl, authRouter);
}
