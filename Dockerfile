FROM node:24-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.26.1 --activate

COPY . .
RUN pnpm install --frozen-lockfile

# Vite embeds these public Clerk values into the browser bundle.
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_PROXY_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PROXY_URL=$VITE_CLERK_PROXY_URL

RUN test -n "$VITE_CLERK_PUBLISHABLE_KEY" \
  && PORT=8080 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/globus-bank run build \
  && pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production
ENV PORT=8080
ENV SERVE_WEB_APP=true

EXPOSE 8080

CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
