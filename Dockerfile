FROM node:20

RUN groupadd -r runner && useradd --no-log-init -r -g runner runner

WORKDIR /workdir

COPY package*.json ./
RUN npm ci

USER runner:runner
COPY --chown=runner:runner . .

ENV NODE_ENV=production

EXPOSE 3000
CMD ["npx", "pm2-runtime", "src/server.mjs", "--instances", "4", "--name", "qlikauth"]
