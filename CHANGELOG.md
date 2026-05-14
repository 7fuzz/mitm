# CHANGELOG

All notable changes to MITM Real will be documented in this file.

## [1.2.0] - 2026-05-15
### Added
- **Single Repeater History Deletion**: You can now delete individual items from a request's execution history in the Workbench.
- **Unified Sidebar Components**: Created a consistent `TrafficItem` component for all sidebars.
- **Visual Consistency**: Replaced the "X" delete icon with a Trash icon across the entire application.
- **Automatic History Injection**: When staging a request from HTTP History to Workbench, the captured response is now automatically saved to the repeater history.
- **Cross-Platform Launcher**: Added `scripts/start-proxy.js` to ensure the proxy runs correctly on both POSIX (Linux/macOS) and Windows.
- **Graceful Shutdown**: Improved signal handling (`SIGINT`/`SIGTERM`) to ensure Next.js and the Python proxy shut down cleanly on `Ctrl+C`.

### Removed
- **Proxy Vault**: Removed the Vault feature in favor of the more robust Workbench Collections and History system.

### Fixed
- **Next.js Shutdown Hang**: Refactored the SSE traffic route to clear heartbeat timers and close connections on exit.

## [1.1.0] - Earlier
### Added
- **Workbench (Repeater)**: Manual request testing with environment variable support.
- **Collections**: Grouping and organization for repeater requests.
- **SSE Traffic Streaming**: Real-time traffic updates from the mitmproxy bridge.
- **Variable System**: Environment-based placeholders for dynamic requests.
- **Multipart/Form-Data Engine**: Advanced abstraction for complex form payloads.

## [1.0.0] - Initial Release
### Added
- **mitmproxy Bridge**: Integration with mitmproxy for traffic interception.
- **HTTP History**: Persistent logging of captured traffic.
- **Intercept Mode**: Pause and modify requests/responses in real-time.
- **SQLite Persistence**: Master database for settings and logs.
