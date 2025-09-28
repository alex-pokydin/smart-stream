ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM $BUILD_FROM

ENV LANG=C.UTF-8
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install system dependencies
RUN apk update && apk add --no-cache \
    nodejs \
    npm \
    ffmpeg \
    git \
    nano \
    curl \
    python3 \
    make \
    g++ \
    && npm install -g pnpm@8.15.9 --force

# Set working directory
WORKDIR /app

# Copy package management files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Build the project
RUN pnpm build

# Remove devDependencies and clean up
RUN pnpm prune --production \
    && pnpm store prune \
    && npm cache clean --force

# Set production environment
ENV NODE_ENV=production

# Copy startup script
COPY run.sh /
RUN chmod a+x /run.sh

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD [ "/run.sh" ]