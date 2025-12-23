# DSG Transport Auto-Login Extension

This Chrome extension enables Bitwarden-style auto-login for DSG Transport tools.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `browser-extension` folder
5. The extension icon will appear in your toolbar

## How It Works

1. Log in to DSG Transport portal
2. Click "Secure Access" on any tool
3. The extension opens the login page and auto-fills credentials
4. Credentials are NEVER visible to Admin/User

## Security

- Credentials are encrypted in transit
- Stored only temporarily (5 min max)
- Automatically cleared after use
- Only works with DSG Transport portal

## Troubleshooting

If auto-fill doesn't work:
1. Make sure the extension is enabled
2. Refresh the login page
3. Check that you clicked "Secure Access" from the portal
