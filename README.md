# bi.dream.gov.ua-qlikauth

```
env REDIS_URL=redis://127.0.0.1:6379/0 SESSION_SECRET=x GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x \
  node src/server.mjs --watch
```

To test, as both anonymous and authenticated user:

- https://bi.dream.gov.ua/api/auth/login/google?redirect=https://bi.dream.gov.ua
- https://bi.dream.gov.ua/api/auth/user/google/test;123
- https://bi.dream.gov.ua/api/auth/logout/google/test;123?redirect=https://bi.dream.gov.ua
- https://bi.dream.gov.ua/api/auth/failed
