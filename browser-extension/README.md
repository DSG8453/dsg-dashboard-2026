# DSG Transport Secure Login Extension

This Chrome extension enables **secure, automatic login** for DSG Transport tools. Credentials are **NEVER visible** to users - just like Bitwarden.

## 🔒 How It Works

1. User clicks "Open Tool" in DSG Transport dashboard
2. Extension receives encrypted credentials (user never sees them)
3. Extension opens the tool's login page
4. Credentials are automatically filled
5. User just clicks the "Login" button

**Users cannot see, copy, or export the actual passwords.**

---

## 📦 Installation Guide

### Step 1: Download Extension
Get the `browser-extension` folder from your IT administrator.

### Step 2: Open Chrome Extensions
1. Open Chrome browser
2. Type `chrome://extensions/` in the address bar
3. Press Enter

### Step 3: Enable Developer Mode
1. Look for "Developer mode" toggle in the **top-right corner**
2. Turn it **ON** (toggle should be blue)

### Step 4: Load the Extension
1. Click the **"Load unpacked"** button (appears after enabling Developer mode)
2. Navigate to and select the `browser-extension` folder
3. Click "Select Folder"

### Step 5: Copy Extension ID
1. After loading, you'll see "DSG Transport Secure Login" in your extensions
2. Find the **ID** under the extension name (looks like: `abcdefghijklmnopqrstuvwxyz123456`)
3. Copy this ID

### Step 6: Enter ID in Dashboard
1. Go to DSG Transport dashboard
2. Click "Open Tool" on any tool
3. Paste your Extension ID when prompted
4. Click "Save"

**You only need to do this once!**

---

## ✅ Using the Extension

1. Go to DSG Transport dashboard
2. Click **"Open Tool"** on any tool (e.g., RMIS)
3. A new tab opens with the tool's login page
4. **Credentials auto-fill automatically** (green flash confirms)
5. Click the **Login button** on the page
6. Done!

---

## 🔐 Security Features

| Feature | Description |
|---------|-------------|
| Hidden Credentials | Users never see actual passwords |
| Auto-Expiry | Credentials clear after 5 minutes |
| Domain Lock | Only works with DSG Transport dashboard |
| No Export | Cannot extract or copy passwords |
| Encrypted Transit | Credentials encrypted between dashboard and extension |

---

## ❓ Troubleshooting

### Credentials didn't auto-fill?
- Wait 2-3 seconds for the page to fully load
- Refresh the login page
- Try clicking "Open Tool" again

### Extension not detected?
1. Make sure the extension icon shows in Chrome toolbar
2. Click the extension icon → verify it shows "Extension Active"
3. Re-enter the Extension ID in the dashboard

### Still having issues?
Contact your DSG Transport administrator.

---

## 🏢 For IT Administrators

### Enterprise Deployment
1. Host the extension folder on internal server
2. Use Chrome Enterprise policies to force-install
3. Or deploy via company software distribution system

### Extension ID
Each installation generates a unique Extension ID. Users must enter this ID once in the DSG Transport dashboard.

### Security Notes
- Extension only communicates with `*.emergentagent.com` and `*.dsgtransport.com`
- Credentials are passed via Chrome's secure messaging API
- No data is stored permanently - auto-clears after 5 minutes

---

## 📞 Support

Contact DSG Transport IT department for assistance.

**Version:** 1.0.0
