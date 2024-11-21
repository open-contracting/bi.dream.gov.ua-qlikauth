FROM node:18-alpine

RUN groupadd -r runner && useradd --no-log-init -r -g runner runner

WORKDIR /workdir
USER runner:runner

COPY --chown=runner:runner package*.json ./
RUN npm ci

COPY --chown=runner:runner . .
ENV NODE_ENV=production

EXPOSE 3000
CMD ["pm2-runtime", "src/server.mjs", "--instances", "4", "--name", "qlikauth"]
