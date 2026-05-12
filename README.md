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
- **Stage to Workbench**: Send the current state of an intercepted request to the Workbench for further testing.

### 3. Workbench
The **Workbench** is where you perform manual request testing.
- Create new requests from scratch or import them from History/Intercept.
- Organize requests into **Collections**.
- Hit **Execute** to send the request and view the response.

### 4. Options & UI Modes
Found in the **Options** tab, you can customize your experience:
- **Simple Mode**: A lightweight experience that hides advanced workspace tools.
- **Memory Limits**: Set a cap on the number of history items kept in the dashboard to maintain performance.
- **Network Bindings**: Configure multiple IP/Port listeners for the proxy engine.

---

## 🛠️ Advanced Features (Simple Mode OFF)

When Simple Mode is disabled, the following advanced tools become available:

### 🌍 Environments & Variable System
Manage multiple server environments (e.g., Development, Staging, Production) with a robust variable system:
- **Variables**: Use `{{placeholder}}` in any Workbench request.
- **Variable Variants**: Create multiple values for a single variable (e.g., "User A", "User B").
- **Smart Persistence**:
  - **Debounced Auto-Save**: Changes to variables are automatically saved to the database after 1 second of inactivity.
  - **Auto-Capture Debounce**: Variables updated via response extraction are debounced for 2 seconds to prevent race conditions.
  - **Auto-Save Toggle**: Globally enable/disable automatic persistence in the Environments section.
  - **Manual Save**: When auto-save is off, use the **[Save]** or **Save All Variables** buttons to manually persist changes.
  - **Bulk API**: Optimized persistence layer that saves entire environments in a single network request.

### 📁 Workbench Collections
Keep your Workbench organized by grouping requests into **Collections**. You can reorder groups, rename them, and export entire collections as JSON projects for sharing or version control.

### 🔄 Automated Replacements
Configure transformation rules that automatically tokenize your traffic in real-time:
- **URL & Param Patterns**: Swap domain prefixes or query parameters.
- **Header Replacements**: Inject or replace values based on header keys (e.g., `Authorization`).
- **Body Keys**: Automatically tokenize specific JSON keys in request bodies.
- **Global Text**: High-power replacement across the entire request (URL, Headers, and Body).

### 📝 Advanced Form Data Handling
The project features a specialized engine for managing complex `multipart/form-data` and `application/x-www-form-urlencoded` payloads:
- **Structured Editing**: Form data is automatically converted into a structured JSON format (`__form_data`) for easy editing and variable interpolation.
- **File Persistence**: Uploaded files are securely stored in the backend and automatically reconstructed into outgoing multipart requests.
- **Auto-Extraction**: Raw intercepted form data is automatically tokenized when staged to the Workbench.
- **Type Conversion**: Seamlessly convert between JSON, URL-Encoded, and Multipart formats with integrated conversion utilities.

### 🧰 Utilities
- **JSON Toolkit**: Format, minify, and recursively filter large JSON payloads. Supports "Send to Toolkit" from any response viewer.
- **CVSS Calculator**: Calculate vulnerability severity scores using the industry-standard CVSS 3.1 framework.

---

## 🔒 SSL Certificate Setup
To intercept HTTPS traffic:
1. Go to the **Options** tab in the dashboard.
2. Click **Download Root CA (.pem)**.
3. Install this certificate on your target device.
4. **Crucial**: On mobile devices, you must manually go into system settings and "Enable full trust for root certificate."
