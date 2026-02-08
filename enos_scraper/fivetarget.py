import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright
import gspread
from google.oauth2.service_account import Credentials
# ช่วยรันโค้ด ใหม่ 3 ขั้นตอน
#pip install playwright
#playwright install
#cd Desktop/enos_scraper
#source venv/bin/activate 
#python ..ชื่อไฟล์...
# =====================================================
# CONFIGURATION
# =====================================================
# URL Settings
LOGIN_URL = "https://app-portal-eu.enos-iot.com/login"
BASE_TARGET_URL = (
    "https://app-portal-eu.enos-iot.com/portal/"
    "sc17591331211951978/rollout_turbinelist"
    "?state=%7B%22site%22%3A%22kpBQhchl%22%2C%22target%22%3A%22kpBQhchl%2FEna1%2F"
)
URL_SUFFIX_END = "%22%7D"
MY_USER = "dev@impactelectrons.com"
MY_PASS = "7GE6gCLwM9XWfORfsCNG"
TARGET_JSON_FILE = "targets.json"   
TARGET_NAMES = ["Active Power", "Wind Speed"]

MAX_CONCURRENT_TABS = 3    
MAX_WAIT = 60
RETRIES = 2
HEADLESS_MODE = False

# รอ 2 นาที ก่อนเริ่มรอบใหม่
LOOP_DELAY_SECONDS = 20   

SERVICE_ACCOUNT_FILE = "scada-key.json"
SPREADSHEET_NAME = "Enos_Wind_Monitoring_DB"
WORKSHEET_NAME = "Live_Status_5Pole"

# =====================================================
# GOOGLE SHEETS SETUP
# =====================================================
def init_google_sheet():
    try:
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive"
        ]
        creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=scopes)
        client = gspread.authorize(creds)
        sheet = client.open(SPREADSHEET_NAME).worksheet(WORKSHEET_NAME)
        return sheet
    except Exception as e:
        print(f"❌ Google Sheet Error: {e}")
        exit()

# =====================================================
# LOAD TARGETS (แก้ไขให้ดึง 5 ตัวแรก)
# =====================================================
def load_target_urls():
    try:
        with open(TARGET_JSON_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        suffixes = data.get("targets", [])
        
        # --- 🔥 แก้ไขตรงนี้ครับ (เอา 5 ตัวแรก) 🔥 ---
        if len(suffixes) > 0:
            # ใช้ [:5] เพื่อดึง 5 ตัวแรก (ถ้ามีน้อยกว่า 5 มันจะดึงเท่าที่มี)
            selected_targets = suffixes[:5] 
            
            print(f">>> 🧪 TESTING MODE: Selected Top {len(selected_targets)} Targets: {selected_targets}")
            
            # สร้าง List URL สำหรับ 5 ตัวนี้
            urls = [BASE_TARGET_URL + str(s) + URL_SUFFIX_END for s in selected_targets]
            return urls
        else:
            print("❌ No targets found in JSON")
            return []
        # ------------------------------------------

    except Exception as e:
        print(f"❌ Error loading targets: {e}")
        return []

# =====================================================
# SCRAPE TARGET
# =====================================================
async def scrape_target(url, context, semaphore, sheet):
    async with semaphore:
        page = await context.new_page()
        
        for attempt in range(1, RETRIES + 1):
            try:
                # print(f">>> 🌐 Open {url[-20:]} (Attempt {attempt})") 
                await page.goto(url)
                
                try:
                    await page.wait_for_load_state("networkidle", timeout=30000)
                    await page.wait_for_selector("iframe", timeout=10000)
                except:
                    pass

                # --- 1. รอ React Render ---
                ready = False
                for _ in range(MAX_WAIT):
                    for frame in page.frames:
                        try:
                            if await frame.locator("span.name").count() > 0:
                                ready = True
                                break
                        except:
                            pass
                    if ready:
                        break
                    await asyncio.sleep(1)

                if not ready:
                    if attempt < RETRIES:
                        await page.close()
                        continue
                    else:
                        print(f"❌ Failed (Not Ready): {url[-20:]}")
                        break

                # --- 2. ดึงชื่อ Turbine ---
                tur_name = "UNKNOWN"
                for frame in page.frames:
                    try:
                        loc = frame.locator("span.turName")
                        if await loc.count() > 0:
                            tur_name = await loc.first.inner_text()
                            break
                    except:
                        pass

                # --- 3. ดึงค่า Values ---
                temp_data = {} 
                for frame in page.frames:
                    for name in TARGET_NAMES:
                        try:
                            name_loc = frame.locator("span.name", has_text=name)
                            if await name_loc.count() == 0:
                                continue
                            
                            value_loc = name_loc.first.locator(
                                'xpath=following-sibling::span[@class="value"]'
                            )
                            raw = await value_loc.inner_text()
                            parts = raw.strip().split()
                            full_value = f"{parts[0]} {parts[1] if len(parts) > 1 else ''}".strip()
                            temp_data[name] = full_value
                        except:
                            continue

                # --- 4. บันทึกทันที ---
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                val_active_power = temp_data.get("Active Power", "")
                val_wind_speed = temp_data.get("Wind Speed", "")

                row = [timestamp, tur_name, val_active_power, val_wind_speed]
                
                try:
                    sheet.append_row(row) 
                    print(f"✅ Saved: {tur_name} | P: {val_active_power} | W: {val_wind_speed}")
                except Exception as save_err:
                    print(f"❌ Save Failed for {tur_name}: {save_err}")

                await page.close()
                return True

            except Exception as e:
                print(f"❌ Error scraping {url[-20:]}: {e}")
                
        await page.close()
        return False

# =====================================================
# MAIN LOOP
# =====================================================
async def main():
    print(">>> 📡 Connecting to Google Sheets...")
    sheet = init_google_sheet()
    print(f">>> ✅ Connected: {SPREADSHEET_NAME}")

    target_urls = load_target_urls()
    print(f">>> 🎯 Loaded {len(target_urls)} targets")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS_MODE, slow_mo=50)
        context = await browser.new_context()

        # --- LOGIN ---
        print(">>> 🔐 Logging in...")
        try:
            login_page = await context.new_page()
            await login_page.goto(LOGIN_URL)
            await login_page.fill('input[type="text"]', MY_USER)
            await login_page.fill('input[type="password"]', MY_PASS)
            async with login_page.expect_navigation(timeout=60000):
                await login_page.keyboard.press("Enter")
            print(">>> 🔓 Login success (Session saved)")
        except Exception as e:
            print(f"❌ Login Failed: {e}")
            return

        # ===========================================
        # 🔄 INFINITE LOOP
        # ===========================================
        cycle_count = 1
        while True:
            start_time = datetime.now()
            print(f"\n>>> 🔄 Start Cycle #{cycle_count} at {start_time.strftime('%H:%M:%S')}")
            
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_TABS)
            tasks = [scrape_target(url, context, semaphore, sheet) for url in target_urls]
            
            await asyncio.gather(*tasks)

            print(f">>> ✅ End Cycle #{cycle_count}. Waiting {LOOP_DELAY_SECONDS} seconds...")
            
            await asyncio.sleep(LOOP_DELAY_SECONDS)
            cycle_count += 1

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n>>> 🛑 Stopped by user.")