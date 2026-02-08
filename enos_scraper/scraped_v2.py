import asyncio
import json
import csv
import os
from datetime import datetime
from playwright.async_api import async_playwright
import gspread
from google.oauth2.service_account import Credentials

# ✅ [เพิ่มส่วนนี้เข้าไป] -----------------------------
import socket 

# FIX: สั่งให้ Python วิ่งเส้นทางหลัก (IPv4) เท่านั้น ไม่หลงไป IPv6
old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(*args, **kwargs):
    res = old_getaddrinfo(*args, **kwargs)
    return [r for r in res if r[0] == socket.AF_INET]
socket.getaddrinfo = new_getaddrinfo
# --------------------------------------------------

#สารบัญ
#36 ช่วยรันโค้ด ใหม่ 3 ขั้นตอน
#56 ⚡ ตัวนี้คือ "ความเร็วในการเปิดจอ"
#61 ⏱️ ตัวนี้คือ "ความอดทนสูงสุดในการรอหน้าเว็บโหลด" (หน่วย: วินาที)
#67 🔄 ตัวนี้คือ "จำนวนครั้งที่จะลองใหม่" ถ้ารอบแรกพัง
#78 🐢 ตัวนี้คือ "เวลาพักเบรกหลังจบงาน" (สำคัญมาก!) (หน่วย: วินาที)
#130 ⏱️ ตรงนี้คือ "รอโหลดเบื้องต้น" (30000 = 30 วินาที)
#134 ⏱️ ตรงนี้คือ "รอหากล่อง Iframe" (10000 = 10 วินาที)
#141 🔄 ลูปนี้จะวนตามจำนวน MAX_WAIT ที่ตั้งไว้ข้างบน (60 รอบ)
#153  ⏱️ ตรงนี้คือ "ความถี่ในการเช็คหน้าเว็บ"
#268 🐢 ดีเลย์ช่วงพักรอบ (Wait Time)


# =====================================================
# CONFIGURATION
# =====================================================

# 36 ช่วยรันโค้ด ใหม่ 3 ขั้นตอน
#cd Desktop/WindEnergyProject/enos_scraper
#source venv/bin/activate 
#python scraped_v2.py    

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

# Scraper Settings

#56 ⚡ ตัวนี้คือ "ความเร็วในการเปิดจอ"
# ถ้าเพิ่มเลข: เปิดหลายจอพร้อมกันได้ งานเสร็จเร็วขึ้น แต่อาจจะกินเครื่องและเน็ตกระตุก
# ถ้าลดเลข: เปิดทีละน้อยๆ ช้าหน่อยแต่ชัวร์ ค่าเดิม = 3
MAX_CONCURRENT_TABS = 3

#61 ⏱️ ตัวนี้คือ "ความอดทนสูงสุดในการรอหน้าเว็บโหลด" (หน่วย: วินาที)
# ตอนนี้ตั้งไว้ 60 วินาที
# - ถ้าหน้าเว็บหมุนติ้วๆ นานเกิน 60 วิ บอทจะตัดใจแล้วปิดทิ้ง (ถือว่า Fail)
# - ถ้าเน็ตช้ามากๆ แนะนำให้เพิ่มเป็น 90 หรือ 120 ค่าเดิม = 60
MAX_WAIT = 120

#67 🔄 ตัวนี้คือ "จำนวนครั้งที่จะลองใหม่" ถ้ารอบแรกพัง
# ตอนนี้ตั้งไว้ 2 รอบ
# - ถ้าเพิ่มเป็น 3-4: บอทจะตื๊อเก่งขึ้น แต่จะเสียเวลาโดยรวมมากขึ้นถ้าเว็บล่มจริง ค่าเดิม = 2
RETRIES = 3
HEADLESS_MODE = False

# Google Sheets Settings
SERVICE_ACCOUNT_FILE = "scada-key.json"
SPREADSHEET_ID = "140LnLJTKi_ZuseVzvfA_H-c7JeyXg1Ol6C7GPelpYXs"
WORKSHEET_NAME = "Live_Status"

# CSV Settings
CSV_OUTPUT_DIR = "result"

#78 🐢 ตัวนี้คือ "เวลาพักเบรกหลังจบงาน" (สำคัญมาก!) (หน่วย: วินาที)
# ตอนนี้ตั้งไว้ 120 วินาที (2 นาที)
# - ถ้าลดเหลือ 60: ข้อมูลจะมาถี่ขึ้น (ทุก 1 นาที) แต่ระวัง Google Sheet บล็อกเพราะเขียนบ่อยเกิน
# - ถ้าเพิ่มเป็น 300: ข้อมูลจะมาทุก 5 นาที เหมาะสำหรับดูภาพรวมยาวๆ ไม่รีบ ค่าเดิม = 120
LOOP_DELAY_SECONDS = 120   


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
        print(f">>> 📂 Opening Sheet ID: {SPREADSHEET_ID[:10]}...")
        sheet = client.open_by_key(SPREADSHEET_ID).worksheet(WORKSHEET_NAME)
        return sheet
    except Exception as e:
        print(f"❌ Google Sheet Error: {e}")
        exit()

# =====================================================
# CSV SETUP
# =====================================================
def get_csv_file_path():
    """สร้างชื่อไฟล์ CSV ตามวันที่ปัจจุบัน"""
    os.makedirs(CSV_OUTPUT_DIR, exist_ok=True)
    date_str = datetime.now().strftime("%Y-%m-%d")
    return os.path.join(CSV_OUTPUT_DIR, f"{date_str}.csv")

def init_csv_writer(file_path):
    """เปิดไฟล์ CSV และเขียน header ถ้าไฟล์ยังว่าง"""
    file_exists = os.path.exists(file_path) and os.path.getsize(file_path) > 0

    csv_file = open(file_path, 'a', newline='', encoding='utf-8-sig', buffering=1)
    writer = csv.writer(csv_file)

    # เขียน header ถ้าไฟล์ใหม่
    if not file_exists:
        writer.writerow(['Timestamp', 'Turbine Name', 'Active Power', 'Wind Speed'])
        csv_file.flush()

    return csv_file, writer

# =====================================================
# LOAD TARGETS
# =====================================================
def load_target_urls():
    try:
        with open(TARGET_JSON_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        suffixes = data.get("targets", [])
        urls = [BASE_TARGET_URL + str(s) + URL_SUFFIX_END for s in suffixes]
        return urls
    except Exception as e:
        print(f"❌ Error loading targets: {e}")
        return []

# =====================================================
# SCRAPE TARGET
# =====================================================
async def scrape_target(url, context, semaphore, sheet, csv_file, csv_writer, csv_lock):
    async with semaphore:
        page = await context.new_page()
        
        for attempt in range(1, RETRIES + 1):
            try:
                # print(f">>> 🌐 Open {url[-20:]} (Attempt {attempt})") 
                await page.goto(url)
                
                try:
                    #130 ⏱️ ตรงนี้คือ "รอโหลดเบื้องต้น" (30000 = 30 วินาที)
                    # ถ้าเน็ตคุณช้ามากๆ จนหน้าขาวนานเกิน 30 วิ ให้เพิ่มเลขตรงนี้เป็น 60000 (1 นาที) ค่าเดิม = 30000
                    await page.wait_for_load_state("networkidle", timeout=60000)
                    
                    #134 ⏱️ ตรงนี้คือ "รอหากล่อง Iframe" (10000 = 10 วินาที) ค่าเดิม = 10 วินาที
                    await page.wait_for_selector("iframe", timeout=20000)
                except:
                    pass

                # --- 1. รอ React Render ---
                ready = False
                #141 🔄 ลูปนี้จะวนตามจำนวน MAX_WAIT ที่ตั้งไว้ข้างบน (60 รอบ)
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
                    
                    #153  ⏱️ ตรงนี้คือ "ความถี่ในการเช็คหน้าเว็บ"
                    # await asyncio.sleep(1) แปลว่า "รอดู 1 วินาที แล้วค่อยเช็คใหม่"
                    # ไม่แนะนำให้แก้ เพราะ 1 วินาที กำลังดีครับ เร็วไปเครื่องร้อน ช้าไปเสียเวลา
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

                # --- 4. บันทึกทันที (Google Sheet + CSV) ---
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                val_active_power = temp_data.get("Active Power", "")
                val_wind_speed = temp_data.get("Wind Speed", "")

                row = [timestamp, tur_name, val_active_power, val_wind_speed]

                # บันทึกลง Google Sheet
                try:
                    sheet.append_row(row)
                    print(f"✅ Saved to Sheet: {tur_name} | P: {val_active_power} | W: {val_wind_speed}")
                except Exception as save_err:
                    print(f"❌ Sheet Save Failed for {tur_name}: {save_err}")

                # บันทึกลง CSV (ใช้ lock เพื่อป้องกัน race condition)
                try:
                    async with csv_lock:
                        csv_writer.writerow(row)
                        csv_file.flush()
                    print(f"✅ Saved to CSV: {tur_name}")
                except Exception as csv_err:
                    print(f"❌ CSV Save Failed for {tur_name}: {csv_err}")

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
    print(f">>> ✅ Connected! Ready to scrape.") 

    target_urls = load_target_urls()
    print(f">>> 🎯 Loaded {len(target_urls)} targets")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=HEADLESS_MODE, 
            slow_mo=50,
            args=['--disable-ipv6']  
        )
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
        csv_file = None
        csv_writer = None
        current_date = None
        csv_lock = asyncio.Lock()

        while True:
            start_time = datetime.now()
            print(f"\n>>> 🔄 Start Cycle #{cycle_count} at {start_time.strftime('%H:%M:%S')}")

            # เช็คว่าวันเปลี่ยนหรือไม่ (สำหรับเปลี่ยนไฟล์ CSV)
            today = start_time.date()
            if csv_file is None or current_date != today:
                # ปิดไฟล์เก่า (ถ้ามี)
                if csv_file is not None:
                    csv_file.close()
                    print(f">>> 📁 Closed old CSV file")

                # เปิดไฟล์ใหม่
                csv_path = get_csv_file_path()
                csv_file, csv_writer = init_csv_writer(csv_path)
                current_date = today
                print(f">>> 📁 CSV file: {csv_path}")

            semaphore = asyncio.Semaphore(MAX_CONCURRENT_TABS)
            tasks = [scrape_target(url, context, semaphore, sheet, csv_file, csv_writer, csv_lock) for url in target_urls]

            # รอกวาดให้ครบทุก URL
            await asyncio.gather(*tasks)

            # Flush CSV เพื่อให้แน่ใจว่าข้อมูลถูกเขียนลงไฟล์
            csv_file.flush()

            # ตรงนี้จะไม่ error แล้ว เพราะประกาศตัวแปรไว้ด้านบนแล้ว
            print(f">>> ✅ End Cycle #{cycle_count}. Waiting {LOOP_DELAY_SECONDS} seconds...")

            #268 🐢 ดีเลย์ช่วงพักรอบ (Wait Time)
            # ตรงนี้คือจุดที่บอทจะ "หลับ" ตามจำนวนวินาทีที่ตั้งไว้ใน LOOP_DELAY_SECONDS (120 วิ)
            # ถ้าอยากให้มันตื่นมาทำงานเร็วขึ้น ให้ไปแก้เลข 120 ด้านบนครับ
            await asyncio.sleep(LOOP_DELAY_SECONDS)
            cycle_count += 1

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n>>> 🛑 Stopped by user.")