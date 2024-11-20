import express from 'express';
import session from 'express-session';
import cors from 'cors';
import Redis from 'ioredis';
import connectRedis from 'connect-redis';
import dotenv from 'dotenv';
dotenv.config();

import useAuthRouter from './routes/auth.mjs';

async function main() {
  const port = process.env.PORT || 3000;

  const app = express();
  app.disable('x-powered-by');
  app.enable('trust proxy');
  app.use(cors());
  // parse application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: true }));

  // redis session store
  const RedisStore = connectRedis(session);
  //Configure redis client
  const redisClient = new Redis(process.env.REDIS_URL);

  redisClient.on('error', function (err) {
    console.log('Could not establish a connection with redis. ' + err);
  });
  redisClient.on('connect', function (err) {
    console.log('Connected to redis successfully');
  });


  app.use(session({
    store: new RedisStore({ client: redisClient }),
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    unset: 'destroy',
    cookie: {
      secure: false,
      httpOnly: true, // if true prevent client side JS from reading the cookie 
    }  
  }));
  app.get('/ping', (req, res) => res.send('pong'));

  useAuthRouter(app);

  app.listen(port, () => {
    console.log(`qlik auth module listening on port ${port}`)
  });
}

main();
