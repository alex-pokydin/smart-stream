#!/usr/bin/with-contenv bashio

# ==============================================================================
# Smart Stream Home Assistant Add-on
# Starts the Smart Stream application with both backend and frontend
# ==============================================================================

set -e

bashio::log.info "Starting Smart Stream..."

# Read configuration from options
export LOG_LEVEL=$(bashio::config 'log_level')
export NODE_ENV="production"

# For Home Assistant ingress, always use the port from ingress configuration
# If running in HA addon mode, use the ingress port, otherwise use configured port
if bashio::config.has_value 'port'; then
    export PORT=$(bashio::config 'port')
else
    export PORT=3000
fi

# Default values if not configured
export LOG_LEVEL=${LOG_LEVEL:-info}

bashio::log.info "Configuration:"
bashio::log.info "  Port: ${PORT}"
bashio::log.info "  Log Level: ${LOG_LEVEL}"

cd /app

# Create necessary directories
mkdir -p /share/smart-stream/data
mkdir -p /share/smart-stream/logs

# Set data directory for the application
export DATA_DIR="/share/smart-stream/data"
export LOG_DIR="/share/smart-stream/logs"

bashio::log.info "Starting Smart Stream service on port ${PORT}..."

# Start backend service in background
export DEBUG="smart-stream:*"
cd /app && PORT=${PORT} node apps/backend/dist/app.js &
BACKEND_PID=$!

bashio::log.info "Backend started with PID ${BACKEND_PID}"

# Wait a moment for backend to start
sleep 5

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    bashio::log.error "Backend failed to start!"
    exit 1
fi

bashio::log.info "Frontend will be served by the backend service (static files)"

# Copy frontend static files to backend public directory for serving
mkdir -p /app/apps/backend/public
cp -r /app/apps/frontend/dist/* /app/apps/backend/public/

bashio::log.info "Frontend static files copied to backend public directory"

# Function to handle shutdown
shutdown() {
    bashio::log.info "Shutting down Smart Stream..."
    
    # Create stop signal file
    touch /tmp/stop_addon
    
    if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
        bashio::log.info "Stopping backend service..."
        kill -TERM $BACKEND_PID
        wait $BACKEND_PID 2>/dev/null
    fi
    
    bashio::log.info "Smart Stream stopped"
    exit 0
}

# Set up signal handlers
trap shutdown SIGTERM SIGINT

bashio::log.info "Smart Stream started successfully!"
bashio::log.info "Web UI and API available at: http://[HOST]:${PORT}"

# Monitor backend process
while true; do
    # Check if we received a termination signal
    if [ -f /tmp/stop_addon ]; then
        bashio::log.info "Stop signal received, exiting..."
        break
    fi
    
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        bashio::log.error "Backend process died! Restarting..."
        cd /app && PORT=${PORT} DEBUG="smart-stream:*" node apps/backend/dist/app.js &
        BACKEND_PID=$!
    fi
    
    sleep 10
done
