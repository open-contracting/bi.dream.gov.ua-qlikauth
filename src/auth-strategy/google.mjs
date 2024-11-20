import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";

export default function useGoogleStrategy(callbackURL) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL,
                scope: ["profile"],
                state: true,
            },
            (accessToken, refreshToken, profile, cb) => {
                return cb(null, profile);
            },
        ),
    );
}
