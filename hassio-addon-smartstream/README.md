# Smart Stream Home Assistant Add-on

Advanced IP camera streaming to multiple platforms (YouTube, Twitch, Custom RTMP) with ONVIF support.

## Features

- **ONVIF Support**: Automatically discover and configure IP cameras
- **Multi-Platform Streaming**: Stream to YouTube, Twitch, or custom RTMP endpoints
- **Modern Web UI**: React-based interface for easy camera management
- **Real-time Monitoring**: Live stream status and performance metrics
- **Auto-start Streams**: Configure cameras to automatically start streaming on startup
- **Home Assistant Integration**: Seamless integration with Home Assistant via Ingress

## Installation

1. Add this repository to your Home Assistant add-ons store
2. Install the "Smart Stream" add-on
3. Configure the add-on options (optional)
4. Start the add-on

## Configuration

### Add-on Options

```yaml
options:
  port: 3303
  log_level: "info"
```

- **port** (optional): Port for the web interface and API (default: 3303)
- **log_level** (optional): Logging level - debug, info, warn, or error (default: info)

## Usage

1. **Access the Web UI**: Click "Open Web UI" in the add-on page (Home Assistant ingress automatically handles routing)
2. **Add Cameras**: Use the camera discovery feature or manually add IP cameras
3. **Configure Streaming**: Set up streaming keys for YouTube, Twitch, or custom RTMP
4. **Start Streaming**: Begin streaming to your preferred platforms
5. **Monitor**: View real-time streaming status and performance metrics

## Data Storage

The add-on stores its configuration and data in `/share/smart-stream/`:
- **data/**: Camera configurations and settings
- **logs/**: Application logs

## Network Requirements

- **Port Access**: The add-on needs access to your IP cameras on the local network
- **Internet Access**: Required for streaming to external platforms (YouTube, Twitch)
- **ONVIF Protocol**: Cameras should support ONVIF for automatic discovery

## Supported Platforms

### Streaming Platforms
- YouTube Live
- Twitch
- Custom RTMP servers

### Camera Protocols
- ONVIF (preferred)
- RTSP
- HTTP/HTTPS streams

## Troubleshooting

### Common Issues

1. **Cameras not discovered**: Ensure cameras support ONVIF and are on the same network
2. **Streaming failures**: Check stream keys and internet connectivity
3. **Performance issues**: Monitor system resources and adjust stream quality settings

### Logs

View add-on logs in Home Assistant for detailed troubleshooting information.

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/your-repo/smart-stream).
