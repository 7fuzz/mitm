# MITM Real - Proxy & Debugging Dashboard

A powerful, developer-centric intercepting proxy and debugging dashboard designed for deep traffic analysis and workspace-based testing.

## 🚀 One-Time Setup

Before running the program for the first time, follow these steps:

### 1. Python Environment
Navigate to the `scripts` directory and create a virtual environment:
```bash
cd scripts
python3 -m venv venv
```

### 2. Install Dependencies
Activate the virtual environment and install the required Python packages:
```bash
source venv/bin/activate
pip install aiohttp mitmproxy
deactivate
cd ..
```

### 3. Build the Dashboard
Install Node dependencies and build the Next.js application:
```bash
npm install
npm run build
```

---

## 🏃 How to Run

To start the proxy engine and the dashboard concurrently, run:
```bash
npm run proxy
```
The dashboard will be available at `http://localhost:3000`.

---

## 📖 Quick Tutorial
### 1. HTTP History
As soon as you point your device or browser to the proxy (default port `8080`), traffic will appear in the **HTTP_History** tab. You can inspect requests, search through them, and clear the log at any time.

### 2. Intercept & Modify
Go to the **Intercept** tab to pause traffic in real-time.
- **Intercept_On**: Traffic will stop here before reaching the server (Request Phase) or the client (Response Phase).
- **Modify**: You can edit the URL, headers, or body.
- **Forward**: Send the modified request/response on its way.
- **Drop**: Kill the request entirely.
- **Stage to Repeater**: Send the current state of an intercepted request to the Repeater for further testing.

### 3. Repeater
The **Repeater** is where you perform manual request testing.
- Create new requests from scratch or import them from History/Intercept.
- Organize requests into **Collections**.
- Hit **Execute** to send the request and view the response.
- **History Tracking**: Every execution is recorded. You can view, compare, and delete individual history items or clear the entire history for a specific request.

---

### 4. Options & UI Modes
Found in the **Options** tab, you can customize your experience:
- **Simple Mode**: A lightweight experience that hides advanced workspace tools.
- **Memory Limits**: Set a cap on the number of history items kept in the dashboard to maintain performance.
- **Network Bindings**: Configure multiple IP/Port listeners for the proxy engine.

---

## 🛠️ Advanced Features (Simple Mode OFF)

### 🌍 Environments & Variable System
Manage multiple server environments (e.g., Development, Staging, Production) with a robust variable system:
- **Variables**: Use `{{placeholder}}` in any Repeater request.
- **Variable Variants**: Create multiple values for a single variable (e.g., "User A", "User B").
- **Smart Persistence**: Debounced auto-save (1s) and auto-capture from responses.

### 📁 Repeater Collections
Keep your Repeater organized by grouping requests into **Collections**. You can reorder groups, rename them, and export entire collections as JSON projects.

### 🔄 Automated Replacements
Configure transformation rules that automatically tokenize your traffic in real-time based on URL, Header, or Body patterns.

### 📝 Advanced Form Data Handling
Specialized engine for managing complex `multipart/form-data` and `application/x-www-form-urlencoded` payloads via the `__form_data` abstraction.

### 🧰 Utilities
- **JSON Toolkit**: Format, minify, and recursively filter large JSON payloads.
- **CVSS Calculator**: Calculate vulnerability severity scores using CVSS 3.1.

---

## 🔒 SSL Certificate Setup
To intercept HTTPS traffic:
1. Go to the **Options** tab in the dashboard.
2. Click **Download Root CA (.pem)**.
3. Install and **Enable full trust** for the certificate on your target device.

---

# 🏗️ Technical Reference & Context

This section provides deep technical insights into the architecture and development patterns of MITM Real.

## 🏛️ High-Level Architecture
The application follows a dual-stack architecture:
1.  **Proxy Engine (Backend)**: Python (`mitmproxy` + `aiohttp`).
    -   `mitmproxy` handles traffic interception via `scripts/bridge.py`.
    -   `aiohttp` serves the REST API at `127.0.0.1:3001`.
2.  **Dashboard (Frontend)**: Next.js 15+ (App Router) using React 19.
    -   Communicates with the Python backend via Next.js API routes (`app/api/`).
    -   Uses **Server-Sent Events (SSE)** for real-time updates.

## 📁 File Structure & Logic
### 1. Frontend (`/app`, `/components`, `/hooks`)
-   **`app/api/`**: Proxy routes bridging the frontend to the Python backend.
-   **`hooks/traffic/`**: Segmented state management unified under `TrafficProvider`.
-   **`components/View/`**: Main page modules (History, Intercept, Repeater, etc.).

### 2. Backend (`/scripts`)
-   **`server.py`**: The main API server.
-   **`bridge.py`**: The mitmproxy addon for interception and capture logic.
-   **`db.py`**: Interface for the SQLite master database.
-   **`api/`**: Segmented Python handlers (core, history, variables, repeater, replacements).

## 🔄 Core Data Flow
1.  **Capture**: `bridge.py` -> `server.py` -> `/api/traffic` (SSE) -> `useTrafficLog` (React).
2.  **Execution**: `RepeaterView` -> `/api/repeater-request` -> `server.py` (Python Client) -> Target.
3.  **Persistence**: UI changes are debounced and persisted to SQLite via the Python API.

## 💾 Data Persistence & Storage
- **`data/master_database.sqlite`**: Primary database for all persistent state.
- **`data/file/`**: Unique storage for files uploaded via the dashboard (referenced in multipart requests).

## 📝 Structured Form Data Handling (`__form_data`)
MITM Real abstracts `multipart/form-data` and `application/x-www-form-urlencoded` into a structured JSON array for easy editing and tokenization.
- **Automatic Reconstruction**: The Python backend detects `__form_data` and builds a proper `aiohttp.FormData` object.
- **File Persistence**: Preserves original names while storing files uniquely in `data/file/`.

## 📡 API Endpoints (Python Backend - Port 3001)

| Category | Endpoint | Description |
| :--- | :--- | :--- |
| **Core** | `/resume/{id}`, `/cert`, `/state` | Intercept control and global state. |
| **Traffic** | `/history`, `/history/{id}` | Traffic log management. |
| **Repeater** | `/repeat`, `/repeater-db`, `/repeater/{id}` | Request execution and persistence. |
| **Collections** | `/repeater-groups`, `/repeater-import` | Group management and imports. |
| **Variables** | `/variables`, `/variables-bulk`, `/environments` | Workspace configuration. |
| **Rules** | `/replacements` | Automated traffic modification rules. |

## 🎣 Core Frontend Hooks
- **`useTraffic`**: Primary unified context hook.
- **`useTrafficLog`**: Captured flows and history.
- **`useVariables`**: Environment and variable resolution.
- **`useRepeater`**: Repeater and collection orchestration.
- **`useConfig`**: Global preferences and intercept modes.

## 📝 Developer Patterns
- **Variable Syntax**: Uses `{{variable_name}}` for dynamic interpolation.
- **Persistence**: 1-2s debouncing to prevent database thrashing.
- **Port Mappings**: Next.js (`3000`), Python API (`3001`), Proxy Listener (`8080`).

## 🎨 Theme & Styling
The application supports both **Light** and **Dark** modes, which are persisted to the SQLite master database.

- **Color Management**: All colors are defined in `app/globals.css` using CSS variables (`--background`, `--foreground`, `--primary`, etc.). 
- **Theming**: Uses Tailwind CSS 4 with `@theme inline` to map these variables.
- **High Contrast**: The light theme is meticulously tuned for readability, specifically for developers who prefer higher contrast on white backgrounds.
- **Atomic Components**: Standardized UI elements (Buttons, Inputs, Textareas) are located in `components/ui/` and should be used to maintain theme consistency.

