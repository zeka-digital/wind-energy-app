# 🚀 Vercel Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ Ready for Deployment
- [x] Next.js configuration files (`next.config.ts`)
- [x] Build scripts in `package.json`
- [x] Environment variable support
- [x] Navigation/routing setup
- [x] API routes configured

### ⚠️ Critical: Data Source Configuration

**Important:** The current API (`app/api/wind-data/route.ts`) reads CSV files from the local filesystem. Vercel's serverless functions cannot access files outside the project directory.

**You have 2 options:**

#### Option 1: Deploy with Static Data (Quick Test)
1. Copy sample CSV files to `public/data/`:
   ```bash
   mkdir -p wind_dashboard/public/data
   cp enos_scraper/result/*.csv wind_dashboard/public/data/
   ```
2. Update API route to read from `public/data/` instead

#### Option 2: Use External Data Source (Recommended)
- Google Sheets API (recommended - your scraper already supports this)
- InfluxDB API
- Host CSV files on external storage (S3, Cloudflare R2, etc.)
- Use ngrok to tunnel to your local scraper (temporary solution)

---

## 🔧 Deployment Steps

### 1. Choose Which Project to Deploy

You have 2 dashboards:
- **`wind_dashboard/`** - Main dashboard (all turbines)
- **`wind_single_dashboard/`** - Single turbine dashboard

### 2. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 3. Deploy via Vercel Dashboard (Easiest Method)

#### A. Connect GitHub Repository
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Select root directory: `wind_dashboard` or `wind_single_dashboard`
5. Framework Preset: **Next.js** (auto-detected)
6. Click "Deploy"

#### B. Configure Environment Variables in Vercel
After first deployment:
1. Go to Project Settings → Environment Variables
2. Add:
   ```
   NEXT_PUBLIC_API_URL = https://your-deployed-url.vercel.app
   ```
   Or leave empty to use relative API path
3. Redeploy

### 4. Deploy via CLI

```bash
# Navigate to project directory
cd wind_dashboard  # or wind_single_dashboard

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 🌐 Post-Deployment Configuration

### Option A: Using Vercel's Own API (Recommended)
1. **No additional configuration needed!**
2. The API will run as a serverless function at `/api/wind-data`
3. Make sure you have data available (see Data Source Configuration above)

### Option B: Using External API (ngrok or other)
1. Set environment variable in Vercel:
   ```
   NEXT_PUBLIC_API_URL = https://your-ngrok-url.ngrok-free.dev
   ```
2. Keep your ngrok tunnel running (or use a paid ngrok plan for persistent URLs)

---

## 📝 Environment Variables Reference

### Local Development (`.env.local`)
```env
NEXT_PUBLIC_API_URL=
```
Leave empty to use local API at `http://localhost:3000/api/wind-data`

### Production (Vercel Dashboard)
```env
NEXT_PUBLIC_API_URL=
```
Options:
- Empty = Use Vercel's own API endpoint (recommended)
- `https://your-ngrok-url.ngrok-free.dev` = External API via ngrok
- `https://your-api-server.com` = Your own API server

---

## 🔍 Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript has no errors: `npm run build` locally

### API Returns 404 or 500
- **404**: No CSV files found
  - Solution: Add sample data or connect to external source
- **500**: File system access error
  - Solution: Update API route to use external data source

### Environment Variables Not Working
- Ensure variable name starts with `NEXT_PUBLIC_` for client-side access
- Redeploy after changing environment variables
- Clear cache: `vercel --force` or redeploy from dashboard

### Data Not Updating
- API route reads from static CSV files on Vercel
- Solution: Use external data source that updates in real-time

---

## 🎯 Recommended Architecture for Production

```
┌─────────────────┐
│  Vercel App     │  ← Next.js Frontend + API Routes
│  (Frontend)     │
└────────┬────────┘
         │
         ├─→ Option 1: Read from public/data/ (static)
         │
         ├─→ Option 2: Fetch from Google Sheets API
         │            (your scraper already writes here)
         │
         ├─→ Option 3: Fetch from InfluxDB
         │            (your v3 scraper supports this)
         │
         └─→ Option 4: Proxy to local machine via ngrok
                      (development/testing only)
```

---

## 📞 Support

For issues:
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Check Vercel build logs for detailed error messages

---

## 🎉 Quick Deploy Checklist

- [ ] Choose dashboard to deploy (`wind_dashboard` or `wind_single_dashboard`)
- [ ] Decide data source strategy (static, Google Sheets, InfluxDB, ngrok)
- [ ] Connect GitHub repo to Vercel
- [ ] Set root directory in Vercel project settings
- [ ] Configure environment variables (if using external API)
- [ ] Deploy and test
- [ ] Update API route if needed for data source

**Ready to deploy?** Start with `wind_single_dashboard` for a simpler first deployment!
