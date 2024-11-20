import passport from 'passport';
import FacebookStrategy from 'passport-facebook';

export default function useFacebookStrategy(callbackURL) {
  passport.use(new FacebookStrategy(
    {
      clientID: process.env.FB_APP_ID,
      clientSecret: process.env.FB_APP_SECRET,
      callbackURL,
      profileFields: [
          'id',
          'displayName',
          'photos'
      ],
    },
    (accessToken, refreshToken, profile, cb) => {
      return cb(null, profile);
    }    
  ));
}