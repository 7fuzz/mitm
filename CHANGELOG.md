# CHANGELOG

## 2026-05-15
- **Graceful Shutdown**: Improved signal handling (`SIGINT`/`SIGTERM`) and refactored SSE traffic route to ensure Next.js and the Python proxy shut down cleanly.
- **Windows Support**: Added `scripts/start-proxy.js` launcher to handle OS-specific virtual environment paths.
- **UI Unification**: Created a consistent `TrafficItem` component and updated all sidebars to use a Trash icon for deletion.
- **Workbench Enhancements**: Added single item deletion for repeater history and automatic response capturing when staging from History.
- **Security**: Completely removed the accidental database backup from git history and updated `.gitignore`.
- **Cleanup**: Removed the legacy Proxy_Vault feature.

## 2026-05-13
- **Repeater UI**: Improved `simpleMode` support and renamed Workbench to Repeater in simple mode.
- **Analytics**: Added hit count tracking and display for repeater items.
- **History Viewer**: Added request history modal for repeater items with raw message support.
- **Replacements**: Fixed auto-save loops and styled the replacements section for better consistency.

## 2026-05-12
- **Persistence**: Fixed history limit leaks and ensured limits apply correctly to the SQLite database.
- **UI Components**: Integrated `DebouncedInput` across Environment and Replacement modules to prevent database thrashing.
- **Bugfixes**: Resolved edge cases in variable variant switching.

## 2026-05-11 & Earlier
- **Workbench Collections**: Added grouping and reordering support for Workbench requests.
- **Form Data Engine**: Implemented advanced abstraction for `multipart/form-data` payloads.
- **Variable System**: Core implementation of `{{variable}}` interpolation and environment switching.
- **Intercept & Modify**: Real-time traffic control and editing via mitmproxy bridge.
- **Initial Release**: Core Proxy Engine, HTTP History, and SQLite master database integration.
