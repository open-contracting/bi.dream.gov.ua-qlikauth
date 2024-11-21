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
