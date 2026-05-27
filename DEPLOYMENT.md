# Deployment Guide

Prompt Refinery deploys as two separate services:

| Part | Host | Free? |
|---|---|---|
| Backend (Express API) | [Render](https://render.com) | ✅ 750 hrs/month |
| Frontend (React / Vite) | [Vercel](https://vercel.com) | ✅ Unlimited |

---

## Step 1 — Deploy the backend on Render

### 1.1 — Create a Render account
Go to [render.com](https://render.com) and sign up (GitHub login recommended).

### 1.2 — New Web Service
1. Click **New +** → **Web Service**
2. Connect your GitHub account and select the **Prompting-App** repository
3. Fill in the settings:

| Field | Value |
|---|---|
| **Name** | `prompt-refinery-api` (or anything you like) |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### 1.3 — Add environment variables
In the Render dashboard under **Environment**, add:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (`sk-ant-...`) |
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/data` |
| `ALLOWED_ORIGINS` | *(leave blank for now — fill in after Step 2)* |

### 1.4 — Add a persistent disk (for Share feature)
In the Render dashboard under **Disks**, click **Add Disk**:

| Field | Value |
|---|---|
| **Name** | `prompt-refinery-data` |
| **Mount Path** | `/data` |
| **Size** | 1 GB |

> Cost: $1/month. Skip this if you don't need the Share feature — shares just won't persist across restarts.

### 1.5 — Deploy
Click **Create Web Service**. Render builds and deploys automatically.  
Once green, note your backend URL — it looks like:  
`https://prompt-refinery-api.onrender.com`

**Test it:** open `https://your-backend-url.onrender.com/api/health` in a browser. You should see:
```json
{"ok":true,"time":"..."}
```

---

## Step 2 — Deploy the frontend on Vercel

### 2.1 — Create a Vercel account
Go to [vercel.com](https://vercel.com) and sign up (GitHub login recommended).

### 2.2 — Import the project
1. Click **Add New** → **Project**
2. Import the **Prompting-App** repository from GitHub
3. Vercel will detect the `vercel.json` at the root automatically

### 2.3 — Add environment variable
Under **Environment Variables**, add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://your-backend-url.onrender.com` *(the URL from Step 1.5)* |

### 2.4 — Deploy
Click **Deploy**. Vercel builds the Vite app and deploys it to a global CDN.  
Your frontend URL will look like: `https://prompt-refinery-xyz.vercel.app`

---

## Step 3 — Wire them together

### 3.1 — Update CORS on Render
Go back to **Render → Environment** and add:

| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://prompt-refinery-xyz.vercel.app` |

If you have a custom domain, add it too (comma-separated):
```
https://prompt-refinery-xyz.vercel.app,https://prompts.yourdomain.com
```

Click **Save Changes** — Render redeploys automatically.

### 3.2 — Test end-to-end
1. Open your Vercel URL
2. Type a rough prompt and click Refine
3. The refined prompt should stream in

---

## Step 4 — Prevent cold starts (optional but recommended)

Render's free tier spins down after **15 minutes of inactivity**, causing a ~30-second cold start on the next request.

**Fix: use UptimeRobot (free)**
1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account
2. Click **Add New Monitor**
3. Type: **HTTP(s)**, URL: `https://your-backend-url.onrender.com/api/health`
4. Monitoring interval: **5 minutes**
5. Save

UptimeRobot pings your backend every 5 minutes, keeping it warm. Cold starts disappear.

---

## Step 5 — Custom domain (optional)

**On Vercel:** Settings → Domains → Add your domain. Vercel handles SSL automatically.

**On Render:** Settings → Custom Domains → Add your domain. Then update `ALLOWED_ORIGINS` to include it.

---

## Local development (unchanged)

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

## Re-deploying after code changes

Both services auto-deploy when you push to `main` on GitHub. No manual steps needed.

```bash
git add -A
git commit -m "your changes"
git push origin main
# Render and Vercel both pick this up automatically
```
