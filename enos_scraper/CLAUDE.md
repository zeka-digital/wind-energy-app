# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Wind Energy SCADA Data Scraper** that collects real-time metrics (Active Power, Wind Speed) from wind turbines via the EnOS IoT platform. The scrapers use browser automation to extract data from iframe-based React dashboards and store results in Google Sheets or InfluxDB.

**Key Context:**
- Target: EnOS IoT platform (https://app-portal-eu.enos-iot.com) with 134 wind turbines
- Challenge: Data is rendered inside iframes with dynamic React components requiring frame iteration
- Solution: Multiple scraper variants optimized for different use cases (single turbine, 5 turbines, all turbines)

## Running the Scrapers

### Setup
```bash
cd Desktop/WindEnergyProject/enos_scraper
source venv/bin/activate
```

### Main Scrapers (Playwright + Google Sheets)
```bash
# Production scraper - all turbines (134 targets from targets.json)
python scraped_v2.py

# Single turbine testing - scrapes first target only
python singletarget_v2.py

# Five turbine testing - scrapes first 5 targets
python fivetarget_v2.py
```

### Legacy Scrapers
```bash
# Selenium-based InfluxDB scrapers (v1-v3)
python " scraper_influx_v3.py"  # Note: filename has leading space

# Original versions (scraped.py, singletarget.py, fivetarget.py) - deprecated
```

## Architecture

### Scraper Execution Flow

1. **Initialization Phase**
   - Connect to Google Sheets API using `scada-key.json` service account
   - Load turbine target IDs from `targets.json` (134 UUIDs)
   - Construct URLs: `BASE_TARGET_URL + turbine_id + URL_SUFFIX_END`

2. **Authentication**
   - Single login to EnOS portal per session
   - Browser context shared across all scraping tasks
   - Session persists for the entire infinite loop

3. **Concurrent Scraping** (controlled by `MAX_CONCURRENT_TABS`)
   - Semaphore limits parallel browser tabs
   - Each target gets its own async task
   - Uses `asyncio.gather()` to coordinate parallel execution

4. **Per-Turbine Scrape Logic**
   - Navigate to turbine-specific URL
   - Wait for network idle + iframe presence
   - **Critical: Iterate all page.frames** to find the iframe containing React content
   - Poll for `span.name` elements (React lazy loading)
   - Extract turbine name from `span.turName`
   - Extract metrics using XPath sibling navigation: `span.name` → `following-sibling::span[@class="value"]`
   - Immediately write row to Google Sheet (no batching)

5. **Infinite Loop Cycle**
   - Sleep for `LOOP_DELAY_SECONDS` between cycles
   - Repeat scraping forever (Ctrl+C to stop)

### Key Technical Patterns

**Iframe Handling:**
```python
for frame in page.frames:
    # Must iterate ALL frames - the data iframe changes index dynamically
    if await frame.locator("span.name").count() > 0:
        # Found the right frame
```

**React Polling Strategy:**
```python
for _ in range(MAX_WAIT):  # Default: 120 seconds
    # Check if React has rendered
    if await frame.locator("span.name").count() > 0:
        break
    await asyncio.sleep(1)  # 1-second poll interval
```

**IPv4 Enforcement Workaround:**
```python
# Global monkey patch to prevent IPv6 connection issues
old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(*args, **kwargs):
    res = old_getaddrinfo(*args, **kwargs)
    return [r for r in res if r[0] == socket.AF_INET]
socket.getaddrinfo = new_getaddrinfo
```

## Configuration Tuning

All `*_v2.py` scrapers share this configuration structure at the top of each file:

| Variable | Default | Purpose | Tuning Guidance |
|----------|---------|---------|-----------------|
| `MAX_CONCURRENT_TABS` | 3 | Parallel browser tabs | Higher = faster but more resource-intensive |
| `MAX_WAIT` | 120 | Seconds to wait for React render | Increase if network is slow |
| `RETRIES` | 3 | Retry attempts per target | Higher = more resilient but slower on failures |
| `LOOP_DELAY_SECONDS` | 120/30/20* | Seconds between scrape cycles | Lower = more frequent data but risks rate limits |
| `HEADLESS_MODE` | False | Run browser without GUI | Set True for production servers |

*Varies by scraper: `scraped_v2.py`=120, `fivetarget_v2.py`=30, `singletarget_v2.py`=20

**Timeout Tuning (inside `scrape_target()` function):**
- Line ~148: `wait_for_load_state("networkidle", timeout=60000)` - Initial page load
- Line ~151: `wait_for_selector("iframe", timeout=20000)` - Iframe appearance
- Line ~172: `await asyncio.sleep(1)` in polling loop - React render check frequency

## Data Flow

**Input:** `targets.json`
```json
{
  "targets": ["d0f3c2ae...", "68390064...", ...]  // 134 turbine UUIDs
}
```

**Output:** Google Sheets row format
```
[timestamp, turbine_name, active_power, wind_speed]
["2025-01-29 10:30:45", "WA101", "1523.4 kW", "8.2 m/s"]
```

**Credentials:**
- `scada-key.json` - Google Sheets API service account (DO NOT COMMIT)
- Hardcoded EnOS credentials in scripts (SECURITY RISK - should migrate to environment variables)

## Common Issues

**Scraper hangs/fails:**
1. Check if React content is inside iframe (use browser DevTools)
2. Increase `MAX_WAIT` timeout
3. Verify XPath selectors still match (site updates may break selectors)

**Google Sheets API errors:**
- Rate limit exceeded: Increase `LOOP_DELAY_SECONDS`
- Auth failed: Verify `scada-key.json` has correct permissions

**IPv6 connection issues:**
- The monkey patch at top of each file should handle this
- If still failing, check if `socket.getaddrinfo` override is active

## Important Notes

- **Do NOT commit:** `scada-key.json`, `credentials.json`, or any files with credentials
- **Security:** Credentials are currently hardcoded - recommend migrating to `.env` file with python-dotenv
- **Naming:** Some files have leading spaces in filenames (e.g., `" scraper_influx_v3.py"`) - handle with quotes in bash
- **Version Control:** `*_v2.py` files are the current production versions; non-v2 files are deprecated but kept for reference
- **Google Sheets:** Target sheet name varies per scraper (`Live_Status` vs `Live_Status_1Pole` vs `Live_Status_5Pole`)
