# MITM Real - Proxy & Debugging Dashboard

A powerful, developer-centric intercepting proxy and debugging dashboard.

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

### 4. Simple Mode vs. Full Mode
Found in the **Options** tab, **Simple_Mode** is enabled by default for a lightweight experience.
- **Simple Mode ON**: Hides advanced features like Environments, Variables, and Utilities. "Send to Workbench" always sends raw data.
- **Simple Mode OFF**: Unlocks the full power of the app, including automated variable replacements and workspace management.

---

## 🛠️ Advanced Features (Simple Mode OFF)

When Simple Mode is disabled, the following advanced tools become available:

### 🌍 Environments
Manage multiple server environments (e.g., Development, Staging, Production). Switching an environment globally updates all associated variables.

### 🔑 Variables & Variants
Define placeholders like `{{token}}` or `{{apiUrl}}` to use in your requests.
- **Global Variables**: Each variable is tied to an environment.
- **Variable Variants**: Create multiple values for a single variable (e.g., "User A", "User B", "Admin").
- **Variants Selection**: Quickly switch between variants without re-typing values.
- **Auto Variant**: Some variables can be updated automatically via response extraction.

### 📁 Workbench Collections (Groups)
Keep your Workbench organized by grouping requests into **Collections**. You can reorder groups, rename them, and export entire collections as JSON projects.

### 🔄 Workbench Replacements
Configure transformation rules that automatically tokenize your traffic:
- **URL Patterns**: Swap domain prefixes (e.g., `api.` -> `api{{env}}.`).
- **Header Replacements**: Replace values based on header keys (e.g., `Authorization` -> `Bearer {{token}}`).
- **Body Keys**: Automatically tokenize specific JSON keys in request bodies.
- **Global Text**: Replace any string match across the entire request (URL, Headers, and Body).

### 🧰 Utilities
A dedicated toolbox for common developer tasks:
- **JSON Toolkit**: Format, minify, and filter large JSON payloads.
- **CVSS Calculator**: Calculate vulnerability severity scores.
- **Encoding/Decoding**: (Coming soon) Base64, URL encoding, etc.

---

## 🔒 SSL Certificate Setup
To intercept HTTPS traffic:
1. Go to the **Options** tab in the dashboard.
2. Click **Download Root CA (.pem)**.
3. Install this certificate on your target device (iOS/Android/Browser).
4. **Crucial**: On mobile devices, you must manually go into settings and "Enable full trust for root certificate."
