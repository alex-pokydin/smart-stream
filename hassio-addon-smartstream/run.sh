#!/usr/bin/with-contenv bashio

set -e

# Load configuration from Home Assistant
LOG_LEVEL=$(bashio::config 'log_level')
CONFIGURED_PORT=$(bashio::config 'port')
DISCOVERY_INTERFACE=$(bashio::config 'discovery_interface')

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
export DISCOVERY_INTERFACE="$DISCOVERY_INTERFACE"

# Set data directory for the application
export DATA_DIR="/share/smart-stream/data"
export LOG_DIR="/share/smart-stream/logs"

# Create necessary directories
mkdir -p "$DATA_DIR"
mkdir -p "$LOG_DIR"

# Configure DNS for better connectivity
bashio::log.info "Configuring DNS for network connectivity..."

# Show current DNS configuration
bashio::log.info "Current DNS configuration:"
cat /etc/resolv.conf | head -10

# Add multiple DNS servers as fallbacks
bashio::log.info "Adding fallback DNS servers..."
{
    echo "# Fallback DNS servers added by Smart Stream"
    echo "nameserver 8.8.8.8      # Google DNS"
    echo "nameserver 8.8.4.4      # Google DNS Secondary"
    echo "nameserver 1.1.1.1      # Cloudflare DNS"
    echo "nameserver 1.0.0.1      # Cloudflare DNS Secondary"
    echo "nameserver 9.9.9.9      # Quad9 DNS"
    echo "nameserver 208.67.222.222  # OpenDNS"
} >> /etc/resolv.conf

# Show updated DNS configuration
bashio::log.info "Updated DNS configuration:"
cat /etc/resolv.conf | head -15

# Test DNS resolution for critical services
bashio::log.info "Testing DNS resolution..."

# Test basic internet connectivity
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    bashio::log.info "✅ Internet connectivity (ping to 8.8.8.8) working"
else
    bashio::log.warning "⚠️ Internet connectivity issues detected"
fi

# Test DNS resolution for common sites
if nslookup google.com > /dev/null 2>&1; then
    bashio::log.info "✅ DNS resolution (google.com) working"
else
    bashio::log.warning "⚠️ DNS resolution (google.com) failed"
fi

# Test all YouTube RTMP endpoints
youtube_endpoints=("a.rtmp.youtube.com" "b.rtmp.youtube.com" "c.rtmp.youtube.com" "d.rtmp.youtube.com")
youtube_working=false

for endpoint in "${youtube_endpoints[@]}"; do
    if nslookup "$endpoint" > /dev/null 2>&1; then
        bashio::log.info "✅ YouTube RTMP DNS resolution ($endpoint) working"
        youtube_working=true
    else
        bashio::log.warning "⚠️ YouTube RTMP DNS resolution ($endpoint) failed"
    fi
done

if [ "$youtube_working" = false ]; then
    bashio::log.warning "🚨 All YouTube RTMP endpoints failed DNS resolution - streaming will likely fail"
    bashio::log.info "Will attempt IP fallbacks during streaming..."
else
    bashio::log.info "✅ At least one YouTube RTMP endpoint is working"
fi

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
