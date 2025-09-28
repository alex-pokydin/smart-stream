ARG BUILD_FROM
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
    bind-tools \
    && npm install -g pnpm@8.15.9 --force

# Set working directory
WORKDIR /app

# Copy package management files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Build the project with environment variables
ENV ADDON_VERSION=1.0.8
ENV HOME_ASSISTANT=true
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

# Ports are handled by Home Assistant ingress and port mapping
# No need to EXPOSE when using ingress system

CMD [ "/run.sh" ]