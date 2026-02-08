# 🏔️ Laos Mountain Wind Farm - Real-time Monitoring System

A comprehensive wind energy monitoring system featuring **3D visualization**, **real-time data scraping**, and **interactive dashboards** for the Laos Mountain Wind Farm project.

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2.3-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?style=flat-square&logo=tailwind-css)

---

## 📁 Project Structure

```
wind-energy-app/
├── enos_scraper/          # Python web scraper for EnOS IoT platform
│   ├── scraped_v2.py      # Production scraper (all 134 turbines)
│   ├── fivetarget_v2.py   # Test scraper (5 turbines)
│   ├── singletarget_v2.py # Test scraper (1 turbine)
│   └── targets.json       # List of turbine UUIDs
│
├── wind_dashboard/        # Main dashboard (all turbines)
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── 3d-dashboard/         # 3D visualization dashboard
│   │   └── api/wind-data/        # API endpoint
│   └── package.json
│
└── wind_single_dashboard/ # Single turbine dashboard
    └── (same structure as wind_dashboard)
```

---

## 🎯 Key Features

### 🌊 Real-time Data Scraping
- **Platform:** EnOS IoT (https://app-portal-eu.enos-iot.com)
- **Targets:** 134 wind turbines
- **Technology:** Playwright (browser automation)
- **Data Points:** Active Power (kW), Wind Speed (m/s), Timestamps
- **Storage:** Google Sheets API + CSV files
- **Update Frequency:** Configurable (default: 30-120 seconds)

### 🎨 3D Interactive Dashboard
- **Framework:** Next.js 16 + React Three Fiber
- **Features:**
  - Real-time 3D visualization of all wind turbines
  - Color-coded turbines by power output
  - Interactive turbine selection
  - Detailed performance metrics
  - Responsive design (Desktop + Mobile)
  - Auto-refresh every 30 seconds

### 📊 Performance Monitoring
- Total power output (MW)
- Average wind speed
- Individual turbine metrics
- Power output distribution
- Real-time status updates

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20+ (for dashboards)
- **Python** 3.12+ (for scraper)
- **npm** or **yarn**

### 1️⃣ Setup Wind Dashboard

```bash
# Navigate to dashboard directory
cd wind_dashboard

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
# http://localhost:3000
```

### 2️⃣ Setup Data Scraper

```bash
# Navigate to scraper directory
cd enos_scraper

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run scraper (all turbines)
python scraped_v2.py

# Or test with single turbine
python singletarget_v2.py
```

---

## 🎮 Usage

### Landing Page (`/`)
- Project overview with features
- **"Launch Dashboard"** button → Navigate to 3D visualization

### 3D Dashboard (`/3d-dashboard`)
- Interactive 3D scene with all turbines
- Click turbine buttons to view details
- Color-coded by power output:
  - 🔵 **Blue** (2001-4000 kW) - Peak Output
  - 🟢 **Green** (1001-2000 kW) - High Output
  - 🟡 **Amber** (501-1000 kW) - Medium Output
  - ⚪ **Gray** (0-500 kW) - Low Output

### Controls
- **Left Click + Drag:** Rotate camera
- **Right Click + Drag:** Pan view
- **Scroll:** Zoom in/out
- **Click Turbine Button:** Show detailed metrics

---

## 🔧 Configuration

### Scraper Settings (`*_v2.py`)
```python
MAX_CONCURRENT_TABS = 3    # Parallel browser tabs
MAX_WAIT = 120             # Seconds to wait for React render
RETRIES = 3                # Retry attempts per target
LOOP_DELAY_SECONDS = 120   # Seconds between scrape cycles
HEADLESS_MODE = False      # Run browser without GUI
```

### Environment Variables
Create `.env.local` in dashboard directories:
```env
# For local development (default: use local API)
NEXT_PUBLIC_API_URL=

# For production (optional: use external API)
NEXT_PUBLIC_API_URL=https://your-api-url.com
```

---

## 📦 Tech Stack

### Frontend
- **Next.js 16.1.6** - React framework with App Router
- **React 19.2.3** - UI library
- **React Three Fiber** - 3D rendering
- **@react-three/drei** - 3D helpers
- **Three.js** - WebGL library
- **Tailwind CSS 4.x** - Styling
- **TypeScript** - Type safety

### Backend/Scraper
- **Python 3.12**
- **Playwright** - Browser automation
- **Google Sheets API** - Data storage
- **asyncio** - Concurrent scraping
- **pandas** - Data processing (optional)

---

## 🌐 Deployment

### Deploy to Vercel

1. **Connect GitHub Repository**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Select root directory: `wind_dashboard` or `wind_single_dashboard`

2. **Configure Build Settings**
   - Framework Preset: **Next.js** (auto-detected)
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Set Environment Variables** (optional)
   ```
   NEXT_PUBLIC_API_URL = https://your-api-url.com
   ```

4. **Deploy**
   - Click "Deploy"
   - Your dashboard will be live in ~2 minutes!

📚 **See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment guide**

---

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  EnOS IoT Platform (134 Wind Turbines)                      │
│  https://app-portal-eu.enos-iot.com                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ (Playwright scraper)
┌─────────────────────────────────────────────────────────────┐
│  Python Scraper (scraped_v2.py)                              │
│  - Concurrent scraping (3 tabs)                              │
│  - Extracts: Active Power, Wind Speed, Timestamp             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ (Writes to)
┌─────────────────────────────────────────────────────────────┐
│  Google Sheets + CSV Files                                   │
│  (enos_scraper/result/*.csv)                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ (Read by)
┌─────────────────────────────────────────────────────────────┐
│  Next.js API Route (/api/wind-data)                          │
│  - Reads latest CSV file                                     │
│  - Returns JSON with turbine data                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ (Fetched by)
┌─────────────────────────────────────────────────────────────┐
│  React Dashboard (3D Visualization)                          │
│  - Auto-refresh every 30 seconds                             │
│  - Interactive 3D scene                                      │
│  - Real-time metrics                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Development

### Run Linter
```bash
npm run lint
```

### Build for Production
```bash
npm run build
npm start
```

### Test Locally
```bash
# Terminal 1: Run scraper
cd enos_scraper
python singletarget_v2.py

# Terminal 2: Run dashboard
cd wind_dashboard
npm run dev
```

---

## 📝 Important Notes

### Data Source
- API currently reads CSV files from `../enos_scraper/result/`
- **For Vercel deployment:** Need to use external data source (Google Sheets API, InfluxDB, or ngrok tunnel)
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for solutions

### Security
- ⚠️ **DO NOT commit:** `scada-key.json`, `.env`, or credential files
- Credentials currently hardcoded in scraper (should migrate to `.env`)
- Google Sheets service account required for scraper

### Browser Automation
- Scraper uses headless Chromium (Playwright)
- Requires stable internet connection
- EnOS platform uses iframe-based React dashboards
- XPath selectors may break if site updates

---

## 🔗 Links

- **Live Dashboard:** (Deploy to get URL)
- **EnOS Platform:** https://app-portal-eu.enos-iot.com
- **Documentation:** [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 📄 License

MIT License - see [LICENSE](./LICENSE)

---

## 🤝 Contributing

This is a private project for wind farm monitoring. For questions or issues, please contact the project maintainer.

---

## 🎓 Built With

- Next.js App Router architecture
- TypeScript strict mode
- ESLint + Prettier
- React Server Components
- CSS Variables for theming
- Responsive design (mobile-first)

---

**Developed for Laos Mountain Wind Farm** 🏔️⚡

_Real-time monitoring made beautiful with 3D visualization_
