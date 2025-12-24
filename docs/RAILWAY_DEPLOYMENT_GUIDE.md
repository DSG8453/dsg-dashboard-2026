# 🚀 Railway Deployment Guide for DSG Transport SecurePass

## Overview
This guide walks you through deploying your DSG Transport credential management system to Railway with the domain `portal.dsgtransport.net`.

---

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Railway account (create at railway.app)
- [ ] Access to DNS settings for dsgtransport.net
- [ ] Your code pushed to GitHub repository

---

## Step 1: Create Railway Account

1. Go to **[railway.app](https://railway.app)**
2. Click **"Start a New Project"**
3. Sign up with **GitHub** (recommended) or email
4. Verify your account

---

## Step 2: Push Code to GitHub

If not already on GitHub:

```bash
# In your project directory
git init
git add .
git commit -m "Initial commit - DSG Transport SecurePass"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dsg-transport-securepass.git
git push -u origin main
```

---

## Step 3: Create Railway Project

1. In Railway dashboard, click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub
4. Select your repository

---

## Step 4: Set Up MongoDB Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"MongoDB"**
3. Railway creates a MongoDB instance automatically
4. Click on the MongoDB service → **"Variables"** tab
5. Copy the `MONGO_URL` (you'll need this)

---

## Step 5: Deploy Backend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repo
3. Railway will auto-detect it's a Python app
4. Go to **"Settings"** tab:
   - **Root Directory:** `backend`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`

5. Go to **"Variables"** tab and add:

| Variable | Value |
|----------|-------|
| `MONGO_URL` | (paste from MongoDB service) |
| `DB_NAME` | `dsg_transport` |
| `SECRET_KEY` | (generate a random 32-char string) |
| `ENCRYPTION_KEY` | (generate using: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) |
| `GOOGLE_CLIENT_ID` | (your Google OAuth client ID) |
| `GOOGLE_CLIENT_SECRET` | (your Google OAuth client secret) |
| `FRONTEND_URL` | `https://portal.dsgtransport.net` |

6. Click **"Deploy"**

---

## Step 6: Deploy Frontend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select the same repo
3. Go to **"Settings"** tab:
   - **Root Directory:** `frontend`
   - **Build Command:** `yarn install && yarn build`
   - **Start Command:** `npx serve -s build -l $PORT`

4. Go to **"Variables"** tab and add:

| Variable | Value |
|----------|-------|
| `REACT_APP_BACKEND_URL` | `https://portal.dsgtransport.net` |

5. Click **"Deploy"**

---

## Step 7: Configure Custom Domain

### For Backend Service:
1. Click on Backend service → **"Settings"**
2. Scroll to **"Domains"**
3. Click **"+ Custom Domain"**
4. Enter: `api.portal.dsgtransport.net`
5. Railway gives you a CNAME record to add

### For Frontend Service:
1. Click on Frontend service → **"Settings"**
2. Scroll to **"Domains"**
3. Click **"+ Custom Domain"**
4. Enter: `portal.dsgtransport.net`
5. Railway gives you a CNAME record to add

---

## Step 8: Configure DNS (at your domain registrar)

### Add these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | portal | (Railway provided value) | 300 |
| CNAME | api.portal | (Railway provided value) | 300 |

**Where to do this:**
- GoDaddy: DNS Management
- Namecheap: Advanced DNS
- Cloudflare: DNS Settings
- Google Domains: DNS

---

## Step 9: Update Environment Variables

After domains are configured, update:

### Backend Variables:
| Variable | New Value |
|----------|--------|
| `FRONTEND_URL` | `https://portal.dsgtransport.net` |

### Frontend Variables:
| Variable | New Value |
|----------|--------|
| `REACT_APP_BACKEND_URL` | `https://api.portal.dsgtransport.net` |

---

## Step 10: Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client
4. Add to **Authorized redirect URIs**:
   - `https://portal.dsgtransport.net/auth/callback`
   - `https://api.portal.dsgtransport.net/api/auth/google/callback`
5. Add to **Authorized JavaScript origins**:
   - `https://portal.dsgtransport.net`
6. Save

---

## Step 11: SSL Certificates

✅ **Automatic!** Railway provisions SSL certificates automatically for custom domains. No action needed.

---

## Step 12: Test Deployment

1. Visit `https://portal.dsgtransport.net`
2. You should see the DSG Transport login page
3. Try logging in with Google
4. Test tool access with auto-login

---

## 🔧 Troubleshooting

### Site not loading?
- Check Railway logs: Click service → **"Logs"** tab
- Verify DNS propagation: Use [dnschecker.org](https://dnschecker.org)
- Wait up to 48 hours for DNS (usually 15-30 min)

### Database connection error?
- Verify MONGO_URL is correct in backend variables
- Check MongoDB service is running (green status)

### Google OAuth not working?
- Double-check redirect URIs match exactly
- Verify client ID and secret are correct

### Extension not working?
- Extension already supports `*.dsgtransport.net`
- No changes needed to extension

---

## 📊 Monitoring

Railway provides:
- **Logs:** Real-time application logs
- **Metrics:** CPU, Memory, Network usage
- **Deployments:** History of all deployments

Access via Railway dashboard → Select service → Tabs

---

## 💰 Billing

1. Go to Railway dashboard → **"Settings"** → **"Billing"**
2. Add payment method
3. Railway charges based on usage (~$20-30/month estimated)

---

## 🔄 Future Updates

To deploy updates:
1. Push changes to GitHub
2. Railway auto-deploys automatically!

Or manually:
1. Go to Railway dashboard
2. Click service → **"Deployments"**
3. Click **"Deploy"**

---

## ✅ Deployment Checklist

- [ ] Railway account created
- [ ] GitHub repo connected
- [ ] MongoDB database created
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Custom domains configured
- [ ] DNS records added
- [ ] Environment variables set
- [ ] Google OAuth updated
- [ ] SSL working (automatic)
- [ ] Site accessible at portal.dsgtransport.net
- [ ] Login working
- [ ] Extension working with new domain

---

## Need Help?

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)

---

© 2024 DSG Transport LLC
