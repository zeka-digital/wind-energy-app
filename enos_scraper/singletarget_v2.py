import asyncio
import json
import csv
import os
from datetime import datetime
from playwright.async_api import async_playwright
import gspread
from google.oauth2.service_account import Credentials
from supabase import create_client, Client

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

# 36 เปิดใหม่พิมพ์ ใหม่ 3 ขั้นตอน
#cd enos_scraper (เข้าห้องหุ่นยนต์)
#source venv/bin/activate (เปิดสวิตช์เครื่องมือ - ต้องเห็นคำว่า (venv))
#python singletarget_v2.py (เริ่มดูดข้อมูล)

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
WORKSHEET_NAME = "Live_Status_1Pole"

# Supabase Settings
SUPABASE_URL = "https://hxgqzxfshumcntgvxyag.supabase.co"
SUPABASE_KEY = "sb_publishable_lZiI1-B6IS2xUwiaJPZvEA_TQ2lCB-2"
SUPABASE_TABLE = "wind_measurements"

# CSV Settings
CSV_FOLDER = "result"

#78 🐢 ตัวนี้คือ "เวลาพักเบรกหลังจบงาน" (สำคัญมาก!) (หน่วย: วินาที)
# ตอนนี้ตั้งไว้ 120 วินาที (2 นาที)
# - ถ้าลดเหลือ 60: ข้อมูลจะมาถี่ขึ้น (ทุก 1 นาที) แต่ระวัง Google Sheet บล็อกเพราะเขียนบ่อยเกิน
# - ถ้าเพิ่มเป็น 300: ข้อมูลจะมาทุก 5 นาที เหมาะสำหรับดูภาพรวมยาวๆ ไม่รีบ ค่าเดิม = 120
LOOP_DELAY_SECONDS = 20


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
# SUPABASE SETUP
# =====================================================
def init_supabase():
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f">>> 🗄️ Connected to Supabase!")
        return supabase
    except Exception as e:
        print(f"❌ Supabase Connection Error: {e}")
        return None

# =====================================================
# SAVE TO SUPABASE
# =====================================================
def save_to_supabase(supabase, timestamp, turbine_name, active_power, wind_speed):
    if supabase is None:
        print("⚠️ Supabase client is None - skipping")
        return False
    
    try:
        # แปลงค่า Active Power และ Wind Speed เป็นตัวเลข
        # ตัดคำว่า "kW" และ "m/s" ออก แล้วแปลงเป็น float
        active_power_value = None
        wind_speed_value = None
        
        if active_power:
            try:
                # ตัด "kW" ออกและแปลงเป็น float
                active_power_value = float(active_power.replace("kW", "").strip())
            except:
                print(f"⚠️ Cannot convert active_power: {active_power}")
        
        if wind_speed:
            try:
                # ตัด "m/s" ออกและแปลงเป็น float
                wind_speed_value = float(wind_speed.replace("m/s", "").strip())
            except:
                print(f"⚠️ Cannot convert wind_speed: {wind_speed}")
        
        data = {
            "timestamp": timestamp,
            "turbine_name": turbine_name,
            "active_power": active_power_value,
            "wind_speed": wind_speed_value
        }
        
        print(f"🔍 Sending to Supabase: {data}")
        response = supabase.table(SUPABASE_TABLE).insert(data).execute()
        print(f"✅ Supabase Status: {response}")
        print(f"✅ Supabase: {turbine_name} saved successfully")
        return True
    except Exception as e:
        print(f"❌ Supabase Save Error: {e}")
        print(f"❌ Error Type: {type(e).__name__}")
        print(f"❌ Full Error Details: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

# =====================================================
# SAVE TO CSV
# =====================================================
def save_to_csv(timestamp, turbine_name, active_power, wind_speed):
    try:
        # สร้างโฟลเดอร์ถ้ายังไม่มี
        os.makedirs(CSV_FOLDER, exist_ok=True)
        
        # ใช้วันที่เป็นชื่อไฟล์
        date_str = datetime.now().strftime("%Y-%m-%d")
        csv_file = os.path.join(CSV_FOLDER, f"{date_str}.csv")
        
        # ตรวจสอบว่าไฟล์มีอยู่แล้วหรือไม่
        file_exists = os.path.isfile(csv_file)
        
        # เขียนข้อมูล
        with open(csv_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            
            # เขียน header ถ้าไฟล์ใหม่
            if not file_exists:
                writer.writerow(['Timestamp', 'Turbine Name', 'Active Power', 'Wind Speed'])
            
            # เขียนข้อมูล
            writer.writerow([timestamp, turbine_name, active_power, wind_speed])
        
        print(f"✅ CSV: {turbine_name} saved to {csv_file}")
        return True
    except Exception as e:
        print(f"❌ CSV Save Error: {e}")
        return False

# =====================================================
# LOAD TARGETS
# =====================================================
def load_target_urls():
    try:
        with open(TARGET_JSON_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        suffixes = data.get("targets", [])
        
        # --- 🔥 แก้ไขตรงนี้ครับ 🔥 ---
        if len(suffixes) > 0:
            # เลือกเอาแค่ตัวแรกสุด (Index 0)
            selected_target = suffixes[0] 
            
            # หรือถ้าอยากเลือกตัวที่ 50 ก็แก้เป็น suffixes[49]
            
            print(f">>> 🧪 TESTING MODE: Selected only ID {selected_target}")
            
            # สร้าง URL ใส่ list เหมือนเดิม (เพื่อให้โค้ดส่วนอื่นทำงานได้ปกติ)
            urls = [BASE_TARGET_URL + str(selected_target) + URL_SUFFIX_END]
            return urls
        else:
            print("❌ No targets found in JSON")
            return []
        # ---------------------------

    except Exception as e:
        print(f"❌ Error loading targets: {e}")
        return []

# =====================================================
# SCRAPE TARGET
# =====================================================
async def scrape_target(url, context, semaphore, sheet, supabase):
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

                # --- 4. บันทึกทันที (ทั้ง 3 ระบบ) ---
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                val_active_power = temp_data.get("Active Power", "")
                val_wind_speed = temp_data.get("Wind Speed", "")

                row = [timestamp, tur_name, val_active_power, val_wind_speed]
                
                # 4.1 บันทึกลง Google Sheets (เดิม - ห้ามลบ)
                try:
                    sheet.append_row(row) 
                    print(f"✅ Google Sheets: {tur_name} | P: {val_active_power} | W: {val_wind_speed}")
                except Exception as save_err:
                    print(f"❌ Google Sheets Failed for {tur_name}: {save_err}")

                # 4.2 บันทึกลง Supabase (ใหม่)
                save_to_supabase(supabase, timestamp, tur_name, val_active_power, val_wind_speed)
                
                # 4.3 บันทึกลง CSV (ใหม่)
                save_to_csv(timestamp, tur_name, val_active_power, val_wind_speed)

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
    # เชื่อมต่อ Google Sheets
    print(">>> 📡 Connecting to Google Sheets...")
    sheet = init_google_sheet()
    print(f">>> ✅ Google Sheets Connected!") 
    
    # เชื่อมต่อ Supabase
    print(">>> 📡 Connecting to Supabase...")
    supabase = init_supabase()

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
        while True:
            start_time = datetime.now()
            print(f"\n>>> 🔄 Start Cycle #{cycle_count} at {start_time.strftime('%H:%M:%S')}")
            
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_TABS)
            tasks = [scrape_target(url, context, semaphore, sheet, supabase) for url in target_urls]
            
            # รอกวาดให้ครบทุก URL
            await asyncio.gather(*tasks)

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