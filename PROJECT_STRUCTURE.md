# MITM Real - Project Structure & Functionality

This document provides a comprehensive overview of the architecture, file structure, and core functions of the **MITM Real** proxy and debugging dashboard.

---

## 🏗️ High-Level Architecture

The project is split into two main components that communicate over a local API:

1.  **Frontend (Next.js/React)**: A modern web dashboard for traffic inspection, request modification, and workspace management.
2.  **Backend (Python/mitmproxy)**: A high-performance proxy engine that intercepts traffic, manages a local SQLite database, and provides a REST API for the frontend.

---

## 📁 File Structure

### 1. Frontend: Next.js Dashboard (`/app`, `/components`, `/hooks`)
-   **`app/`**: Next.js App Router structure.
    -   **`layout.tsx` & `page.tsx`**: The main shell and entry point of the dashboard.
    -   **`api/`**: Proxy routes that bridge the frontend to the Python backend (e.g., `/api/traffic`, `/api/history`, `/api/variables`).
-   **`components/`**: Modular UI components.
    -   **`View/`**: Main page views (History, Intercept, Workbench/Repeater, Saved, Options, Utilities).
    -   **`Sidebar/`**: Navigation and traffic list components.
    -   **`Editor/`**: specialized editors for JSON, Form Data, Headers, and URLs.
    -   **`ui/`**: Reusable low-level components (JsonViewer, HttpResponseViewer, StatusBadge, etc.).
-   **`hooks/traffic/`**: The core state management layer.
    -   Uses segmented hooks (`useTrafficLog`, `useVariables`, `useConfig`, `useSelection`, etc.) unified under a single `TrafficProvider`.
    -   Handles real-time updates via **Server-Sent Events (SSE)**.

### 2. Backend: Proxy Engine (`/scripts`)
-   **`server.py`**: The main aiohttp server that hosts the REST API used by the dashboard.
-   **`bridge.py`**: The mitmproxy addon script. It hooks into `request`, `response`, and `error` events to log traffic and implement "Intercept" pauses.
-   **`db.py`**: A clean interface for the **SQLite** master database.
-   **`api/`**: Segmented Python handlers for different API domains:
    -   `core.py`: State management and certificate retrieval.
    -   `history.py`: Managing the persistent HTTP history.
    -   `variables.py`: Environment and variable CRUD operations.
    -   `repeater.py`: Workbench/Repeater request execution and persistence.
    -   `replacements.py`: Automated rule management.

---

## 🔑 Core Functions

### 1. Real-time Traffic Interception
-   **Process**: Traffic flows through `bridge.py`. It assigns a unique ID to every flow and pushes it to the dashboard via SSE.
-   **Intercept**: When "Intercept" is ON, the proxy pauses the flow execution and waits for a "Resume" signal from the dashboard (via `handle_resume` in `core.py`).

### 2. Workbench (Repeater)
-   Allows manual construction and re-execution of HTTP requests.
-   Supports **Collections** (Groups) for organization.
-   Requests can be staged from the History or Intercept views.

### 3. Environment & Variable System
-   **Variables**: Placeholders like `{{base_url}}` that are resolved dynamically before a request is sent.
-   **Environments**: Scopes for variables. Switching an environment changes the values of all associated variables.
-   **Variants**: Each variable can have multiple value variants (e.g., different user tokens).
-   **Auto-Save**: Implements a debounced persistence layer (1-2 seconds) to ensure changes are saved without overwhelming the database.

### 4. Automated Replacements
-   A rule-based engine that automatically modifies traffic based on patterns.
-   Rules can target URLs, Headers, JSON body keys, or perform global text replacement.

### 5. JSON Toolkit
-   An integrated utility for manipulating JSON data.
-   Features include formatting, minification, and recursive filtering/search.

---

## 💾 Data Persistence
-   **Database**: `data/master_database.sqlite`
-   **Tables**:
    -   `history`: Persistent log of intercepted traffic.
    -   `environments` & `variables`: Workspace configuration.
    -   `variable_values`: Variants for each variable.
    -   `repeater_requests` & `repeater_groups`: Workbench state.
    -   `replacements`: Automated modification rules.
    -   `settings`: Global dashboard preferences and network bindings.

---

## 📡 Communication Flow

1.  **Dashboard -> Proxy (Command)**: HTTP POST/PUT/DELETE requests to `/api/...` which are proxied to the Python server at `127.0.0.1:3001`.
2.  **Proxy -> Dashboard (Events)**: Server-Sent Events (SSE) stream at `/api/traffic` for real-time notification of new requests or intercept states.
3.  **Client -> Proxy -> Server**: Standard mitmproxy flow, optionally paused by the Intercept engine.
