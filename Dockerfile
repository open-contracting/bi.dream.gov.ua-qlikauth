FROM node:20

RUN groupadd -r runner && useradd --no-log-init -r -g runner runner

ENV NODE_ENV=production

RUN corepack enable

WORKDIR /workdir

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts --prod

USER runner:runner
COPY --chown=runner:runner src src/

EXPOSE 3000
CMD ["node", "src/server.mjs", "--title", "qlikauth"]
