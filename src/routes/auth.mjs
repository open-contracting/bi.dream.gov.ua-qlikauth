import express from 'express';
import passport from 'passport';
import { redirectToQlik, userFromRequest, webLoginSuccessHandler } from './utils.mjs';
import { getUserSessions, deleteUserAndSessions } from '../qlik-utils.mjs';
import useGoogleStrategy from '../auth-strategy/google.mjs';

const WEB_LOGIN = 'web_login';
const MODULE_LOGIN = 'module_login';
const GOOGAuthCallback = `${process.env.DOMAIN}/api/auth/google_auth_callback`;
const AUTH_FAILED_URL = `${process.env.DOMAIN}/api/auth/failed`;
//const AUTH_SUCCESS_URL = '/api/auth/login_success';

function isUserSessionActive(req, userdir, user) {
  return req.session 
    && req.session.user_id === `${userdir.toLowerCase()};${user.toLowerCase()}`;
}

const authRouter = express.Router();

// web login using the specified strategy
authRouter.get('/login/:strategy', async (req, res, next) => {
  // console.log('Headers ', req.headers);
  const { strategy } = req.params;
  const redirect = req.query.redirect;
  if(!strategy || !redirect)
    return res.sendStatus(400); // Bad request

  req.session.login_type = WEB_LOGIN;
  req.session.redirect = redirect;

  passport.authenticate(strategy, { failureRedirect: AUTH_FAILED_URL, failureMessage: false })(req, res,  next);
});


// web logout
authRouter.get('/logout/:userdir/:user', async (req, res) => {
  const redirect = req.query.redirect;
  const { userdir, user } = req.params;
  if(!userdir || !user || !redirect)
    return res.sendStatus(400); // Bad request

  if(isUserSessionActive(req, userdir, user)) {
    console.log('SESS', req.session, userdir, user);
    req.session = null;
    await deleteUserAndSessions(process.env.QLIK_PROXY_SERVICE, userdir, user);
  }
  res.redirect(redirect);
});


authRouter.get('/user/:userdir/:user', /*isLoggedIn,*/ async (req, res) => {
  const { userdir, user } = req.params;
  if(!userdir || !user)
    return res.sendStatus(400); // Bad request

  // if(isUserSessionActive(req, userdir, user)) {
  const data = await getUserSessions(process.env.QLIK_PROXY_SERVICE, userdir, user);
  res.json(data);
  // } else 
  //   res.json({});
});


// Qlik auth module handler
authRouter.get('/module/:strategy?', async (req, res, next) => {
  const { strategy } = req.params;
  let authStrategy = strategy || 'google';
  const { targetId, proxyRestUri } = req.query;
  req.session.login_type = MODULE_LOGIN;
  req.session.targetId = targetId;
  req.session.proxyRestUri = proxyRestUri;

  // Authenticate against specified strategies
  // successRedirect
  passport.authenticate(authStrategy, { failureRedirect: AUTH_FAILED_URL, failureMessage: false })(req, res,  next);
});


// 401 Unauthorized
authRouter.get('/failed', (_, res) => res.sendStatus(401));


// Google auth callback
authRouter.get('/google_auth_callback', passport.authenticate('google'), async (req,  res, next) => {
  // console.log(req.user);
  if(req.session.login_type === WEB_LOGIN) {
    req.session.login_type = null;
    webLoginSuccessHandler(req, res);
  }
});


export default function useAuthRouter(app) {
  app.use(passport.initialize());

  passport.serializeUser(function(user, cb) {
    process.nextTick(() => cb(null, user));
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(() => cb(null, user));
  });

  useGoogleStrategy(GOOGAuthCallback);
  app.use('/api/auth', authRouter);
}