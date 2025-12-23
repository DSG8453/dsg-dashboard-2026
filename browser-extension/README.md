# DSG Transport Secure Login Extension

This Chrome extension enables secure auto-login for DSG Transport tools.
Credentials are NEVER visible to users.

## Installation (For Users)

### Method 1: Install from File (Recommended for Companies)
1. Download the extension folder from your IT admin
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right corner)
4. Click "Load unpacked"
5. Select the `browser-extension` folder
6. Done! You'll see the DSG shield icon in your toolbar

### Method 2: Chrome Web Store (Coming Soon)
- Extension will be available on Chrome Web Store
- Just search for "DSG Transport Secure Login"

## How It Works

1. **You open DSG Transport dashboard**
2. **You click "Open Tool"** on any tool (e.g., RMIS)
3. **Extension automatically:**
   - Opens the tool's login page
   - Fills in your credentials (you never see them)
   - Shows a "Credentials filled" notification
4. **You just click the Login button!**

## Security Features

- ✅ Credentials are NEVER displayed
- ✅ Credentials are encrypted in transit
- ✅ Auto-clears credentials after 5 minutes
- ✅ Only works with DSG Transport dashboard
- ✅ Cannot be used to extract passwords

## Troubleshooting

**Q: Credentials didn't auto-fill?**
- Refresh the login page and try again
- Make sure the extension icon shows in your toolbar
- Try clicking "Open Tool" again from the dashboard

**Q: Extension not working?**
- Check that Developer mode is enabled
- Try removing and re-adding the extension
- Contact your IT administrator

## For IT Administrators

To deploy company-wide:
1. Host the extension folder on your internal server
2. Use Chrome Enterprise policies to force-install
3. Or distribute via your company's software deployment system

## Support

Contact your DSG Transport administrator for help.
