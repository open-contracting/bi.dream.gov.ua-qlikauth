# https://hub.docker.com/r/keymetrics/pm2qs has no Node 20+ images.
# https://github.com/keymetrics/docker-pm2/blob/master/tags/latest/slim/Dockerfile
FROM node:20

RUN groupadd -r runner && useradd --no-log-init -r -g runner runner

ENV NODE_ENV=production

WORKDIR /workdir

COPY package*.json ./
RUN npm ci

USER runner:runner
COPY --chown=runner:runner src src/

EXPOSE 3000
CMD ["node", "src/server.mjs", "--title", "qlikauth"]
