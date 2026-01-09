# DSG Transport Extension - Google Workspace Deployment Guide

## Overview
This guide explains how to deploy the DSG Transport Secure Login extension to all users in your Google Workspace domain automatically.

## Prerequisites
- Google Workspace Standard, Business, or Enterprise subscription
- Admin access to Google Admin Console (admin.google.com)
- Users must be signed into Chrome with their company Google account

---

## Step 1: Access Google Admin Console

1. Go to **[admin.google.com](https://admin.google.com)**
2. Sign in with your Super Admin account (`info@dsgtransport.net`)

---

## Step 2: Navigate to Chrome Management

1. Click **Devices** in the left menu
2. Click **Chrome** → **Apps & extensions**
3. Select **Users & browsers** tab

---

## Step 3: Add the Extension

### Option A: Force Install from URL (Recommended)

1. Click the **+** (Add) button → **Add Chrome app or extension by ID**
2. In the dialog:
   - **Extension ID**: Leave blank for now (we'll configure via policy)
   - **Installation URL**: 
     ```
     https://keyvault-27.preview.emergentagent.com/extension-update.xml
     ```
3. Click **Save**

### Option B: Force Install via Policy (Advanced)

1. Go to **Devices** → **Chrome** → **Settings**
2. Select **Users & browsers**
3. Scroll to **Apps and Extensions** section
4. Click **Managed extensions**
5. Add new policy:
   ```json
   {
     "installation_mode": "force_installed",
     "update_url": "https://keyvault-27.preview.emergentagent.com/extension-update.xml"
   }
   ```

---

## Step 4: Configure Target Users/OUs

1. In the left panel, select the **Organizational Unit (OU)** to apply to:
   - Select top-level OU to apply to ALL users
   - Or select specific OUs for targeted deployment

2. For DSG Transport, recommended OUs:
   - `@dsgtransport.net` users (Super Admins)
   - `@dsgtransport.com` users (Admins/Users)
   - `@teamdsgtransport.com` users (Admins/Users)

---

## Step 5: Save and Apply

1. Click **Save** at the bottom
2. Changes propagate within **24 hours** (usually faster, ~15-30 minutes)

---

## Step 6: Verify Deployment

### For Admins:
1. Go to **Devices** → **Chrome** → **Apps & extensions**
2. You should see the extension listed with "Force installed" status

### For Users:
1. Open Chrome browser (signed in with company account)
2. Go to `chrome://extensions`
3. The "DSG Transport Secure Login" extension should appear automatically
4. Users CANNOT uninstall force-installed extensions

---

## Troubleshooting

### Extension Not Appearing?
1. Ensure user is signed into Chrome with their company Google account
2. Wait up to 24 hours for policy propagation
3. Try: Chrome menu → **Settings** → **Sync and Google services** → **Manage what you sync** → Enable "Extensions"
4. Force sync: Go to `chrome://policy` and click **Reload policies**

### Users Can Uninstall?
This means the extension is not force-installed. Check:
1. Admin Console shows "Force installed" status
2. User is in correct Organizational Unit
3. User is signed into Chrome with managed account

### Extension Shows Errors?
1. Check the extension update URL is accessible
2. Verify the ZIP file and manifest are valid
3. Check Chrome version compatibility (Manifest V3 requires Chrome 88+)

---

## Extension Files Location

| File | URL |
|------|-----|
| Extension ZIP | `https://keyvault-27.preview.emergentagent.com/dsg-transport-extension.zip` |
| Update Manifest | `https://keyvault-27.preview.emergentagent.com/extension-update.xml` |
| Policy JSON | `https://keyvault-27.preview.emergentagent.com/extension-policy.json` |

---

## Security Notes

1. **Force-installed extensions cannot be uninstalled by users** - This ensures all employees have the extension
2. **Extensions update automatically** - When you update the ZIP file, all users get the update
3. **Only works with managed accounts** - Personal Gmail accounts won't receive the extension
4. **Audit trail** - Google Admin Console logs all extension installations

---

## Support

For issues with this deployment, contact:
- DSG Transport IT: [Your IT Contact]
- Google Workspace Support: [admin.google.com/support](https://admin.google.com/support)
