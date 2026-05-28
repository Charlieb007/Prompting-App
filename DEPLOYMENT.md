# Deployment Guide

Prompt Refina deploys as two separate services:

| Part | Host | Free? | Live URL |
|---|---|---|---|
| Backend (Express API) | [Render](https://render.com) | ✅ 750 hrs/month | https://prompt-refina-api.onrender.com |
| Frontend (React / Vite) | [Vercel](https://vercel.com) | ✅ Unlimited | https://promptrefina.vercel.app |

---

## Step 1 — Deploy the backend on Render

### 1.1 — Create a Render account
Go to [render.com](https://render.com) and sign up (GitHub login recommended).

### 1.2 — Connect GitHub
1. Click **New +** → **Web Service**
2. Connect your GitHub account — go to github.com/settings/installations, find Render, and add the **Prompting-App** repo
3. Select the **Prompting-App** repository

### 1.3 — Configure the service

| Field | Value |
|---|---|
| **Name** | `prompt-refina-api` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | *(leave blank)* |
| **Runtime** | `Node` |
| **Build Command** | `npm install --prefix server` |
| **Start Command** | `node server/index.js` |
| **Plan** | Free |

### 1.4 — Add environment variables
Under **Environment**, add:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (`sk-ant-...`) |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | *(leave blank — CORS open by default; add your Vercel URL for security)* |

### 1.5 — Deploy
Click **Create Web Service**. Once green, your backend URL is:
`https://prompt-refina-api.onrender.com`

**Test:** open `https://prompt-refina-api.onrender.com/api/health` — you should see `{"ok":true}`.

---

## Step 2 — Deploy the frontend on Vercel

### 2.1 — Create a Vercel account
Go to [vercel.com](https://vercel.com) and sign up (GitHub login recommended).

### 2.2 — Import the project
1. Click **Add New** → **Project**
2. Import **Prompting-App** from GitHub
3. Vercel auto-detects `vercel.json`

### 2.3 — Add environment variable

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://prompt-refina-api.onrender.com` |

### 2.4 — Deploy
Click **Deploy**. Your frontend will be live at `https://promptrefina.vercel.app`.

---

## Step 3 — Prevent cold starts (recommended)

Render's free tier sleeps after **15 minutes of inactivity** → ~30 second cold start.

**Fix: UptimeRobot (free)**
1. Go to [uptimerobot.com](https://uptimerobot.com) → **Add New Monitor**
2. Type: **HTTP(s)**, URL: `https://prompt-refina-api.onrender.com/api/health`
3. Interval: **14 minutes**
4. Save

---

## Step 4 — Custom domain (optional)

**On Vercel:** Settings → Domains → add your domain. Vercel handles SSL.

**On Render:** Settings → Custom Domains → add your domain, then add it to `ALLOWED_ORIGINS`.

---

## Browser Extension

The extension in `extension/` connects to the production backend by default.
Load it unpacked in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `extension/`.

To point it at a different backend, edit `extension/config.js`.

---

## Local development

```bash
# Backend
cd server
cp .env.example .env          # fill in ANTHROPIC_API_KEY
npm install
npm run dev                   # runs on http://localhost:3001

# Frontend (separate terminal)
cd client
npm install
npm run dev                   # runs on http://localhost:5173
```

---

## Auto-deploy on push

Both services auto-deploy when you push to `main`:

```bash
git add -A
git commit -m "your changes"
git push origin main
# Render and Vercel both redeploy automatically
```
