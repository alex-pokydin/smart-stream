#!/usr/bin/with-contenv bashio

set -e

# Load configuration from Home Assistant
LOG_LEVEL=$(bashio::config 'log_level')
CONFIGURED_PORT=$(bashio::config 'port')

# Use configured port, default to 3303
PORT=${CONFIGURED_PORT:-3303}
ADDON_VERSION=$(bashio::addon.version)

bashio::log.info "Starting Smart Stream Add-on v${ADDON_VERSION}..."

# Set up environment variables for the application
export NODE_ENV=production
export HOME_ASSISTANT=true
export PORT="$PORT"
export LOG_LEVEL="$LOG_LEVEL"
export ADDON_VERSION="$ADDON_VERSION"
export DEBUG="smart-stream:*"

# Set data directory for the application
export DATA_DIR="/share/smart-stream/data"
export LOG_DIR="/share/smart-stream/logs"

# Create necessary directories
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

# Change to app directory
cd /app

# Copy frontend static files to public directory for serving
bashio::log.info "Setting up frontend static files..."
mkdir -p /app/public
cp -r /app/apps/frontend/dist/* /app/public/

# For debugging - show what files were copied
bashio::log.info "Frontend files setup complete. Files in /app/public:"
ls -la /app/public/ | head -10

# Start the application
bashio::log.info "Starting Smart Stream on port $PORT..."

# Start the server in the foreground (don't use &)
# This ensures the process stays alive and the watchdog can monitor it properly
node apps/backend/dist/app.js
