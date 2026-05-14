# CHANGELOG

## 2026-05-15
- **Graceful Shutdown**: Improved signal handling (`SIGINT`/`SIGTERM`) and refactored SSE traffic route to ensure Next.js and the Python proxy shut down cleanly on `Ctrl+C`.
- **Windows Support**: Added `scripts/start-proxy.js` launcher to handle OS-specific virtual environment paths (`bin` vs `Scripts`).
- **UI Unification**: Created a consistent `TrafficItem` component and updated all sidebars to use a Trash icon for deletion.
- **Workbench Enhancements**: Added single item deletion for repeater history and automatic response capturing when staging from History.
- **Security**: Completely removed the accidental database backup from git history and updated `.gitignore` to prevent future tracking of `.bak` and `.sqlite` files.
- **Cleanup**: Removed the legacy Proxy_Vault feature.

## 2026-05-13
- **Repeater UI**: Renamed Workbench to Repeater in simple mode for better clarity.
- **Analytics**: Added hit count tracking and display for repeater items, optimized into the header layout.
- **History Viewer**: Added request history modal for repeater items with raw message support.
- **Replacements**: Fixed auto-save loops and styled the replacements section for better consistency with other modules.
- **Bugfixes**: Resolved missing `simpleMode` logic in ReplacementsSection.

## 2026-05-12
- **Persistence**: Fixed history limit leaks and ensured limits apply correctly to the SQLite database.
- **Form Data Engine**: Major overhaul of `multipart/form-data` and `x-www-form-urlencoded` support, including auto-extraction of files when staging requests.
- **Body Conversion**: Added intelligent body conversion between JSON and Form Data with automatic Content-Type detection.
- **Variable System**: Implemented bulk variable saving and improved variant switching reliability.
- **SSE Stability**: Improved SSE stability with heartbeats and automatic reconnection logic.
- **UI Components**: Refactored debounced input into a reusable UI component and integrated it across the app to prevent database thrashing.
- **Migrations**: Added database migrations for missing columns in `repeater_workspace`.

## 2026-05-11
- **JSON Viewer**: Fixed rendering of double quotes in string values.

## 2026-05-09
- **Initial Core Features**: Implemented Simple Mode, global text replacements, and unified UI.
- **Workspace Redesign**: Refactored `WorkspaceView` into modular sections and implemented resizable sidebars.
- **Cleanup**: Modularized config folders and moved seeding logic into the Python backend.
- **Quality**: Resolved initial linting errors and enhanced type safety across the board.
