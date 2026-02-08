# ==============================================================================
# 🤖 SCADA COLLECTOR V37 (Optimized)
# ==============================================================================
# ปรับปรุงจาก V36:
# 1. ใช้ Smart Wait (WebDriverWait) แทน time.sleep เพื่อความเร็ว
# 2. ปรับปรุง Regex ให้รองรับกรณีตัวเลขติดกับตัวอักษร
# 3. เพิ่มระบบ Auto-Relogin หาก Session หลุด
# 4. จัดระเบียบ Code เป็น Class Structure
# ==============================================================================

import time
import datetime
import os
import sys
import csv
import re
import traceback

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException

import gspread
from oauth2client.service_account import ServiceAccountCredentials

# --- 1. การตั้งค่า (Configuration) ---
CONFIG = {
    "SCADA_URL": "https://app-portal-eu.enos-iot.com/login",
    "TARGET_URL": "https://app-portal-eu.enos-iot.com/portal/sc17591331211951978/rollout_turbinelist",
    "USERNAME": "dev@impactelectrons.com",
    "PASSWORD": "7GE6gCLwM9XWfORfsCNG",
    "JSON_KEY_FILE": "scada-key.json",
    "SHEET_NAME": "Wind_Data_Log",
    "TARGET_TURBINES": ["WA101", "WA102", "WA103", "WA104", "WA105"],
    "INTERVAL_MINUTES": 1,
    "HEADLESS": False  # เปลี่ยนเป็น True ถ้าจะรันบน Server แบบไม่เปิดหน้าต่าง
}

class ScadaBot:
    def __init__(self):
        self.driver = None
        self.sheet = self.init_gsheet()
        self.setup_driver()

    def init_gsheet(self):
        """ เชื่อมต่อ Google Sheet """
        if not os.path.exists(CONFIG["JSON_KEY_FILE"]):
            print("⚠️ ไม่พบไฟล์ Key JSON ข้ามการต่อ Sheet")
            return None
        try:
            scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
            creds = ServiceAccountCredentials.from_json_keyfile_name(CONFIG["JSON_KEY_FILE"], scope)
            client = gspread.authorize(creds)
            print("✅ เชื่อมต่อ Google Sheet สำเร็จ")
            return client.open(CONFIG["SHEET_NAME"]).sheet1
        except Exception as e:
            print(f"❌ เชื่อมต่อ Sheet ไม่ได้: {e}")
            return None

    def setup_driver(self):
        """ ตั้งค่า Chrome Driver """
        print("🌐 กำลังเริ่มระบบ Chrome Driver...")
        options = webdriver.ChromeOptions()
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        
        # ปิดแถบแจ้งเตือน Automation
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)

        if CONFIG["HEADLESS"]:
            options.add_argument('--headless=new')

        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=options)
        self.driver.maximize_window()

    def login(self):
        """ ฟังก์ชันล็อกอิน """
        try:
            print("🔐 กำลังล็อกอิน...")
            self.driver.get(CONFIG["SCADA_URL"])
            
            # รอช่อง username สูงสุด 20 วิ
            user_field = WebDriverWait(self.driver, 20).until(EC.element_to_be_clickable((By.ID, "account")))
            user_field.clear()
            user_field.send_keys(CONFIG["USERNAME"])
            
            pass_field = self.driver.find_element(By.ID, "password")
            pass_field.clear()
            pass_field.send_keys(CONFIG["PASSWORD"])
            
            self.driver.find_element(By.CSS_SELECTOR, ".login-form-button").click()
            
            # รอจนกว่า URL จะเปลี่ยน หรือเจอ Element หน้าหลัก
            WebDriverWait(self.driver, 30).until(
                lambda d: d.current_url != CONFIG["SCADA_URL"]
            )
            print("✅ ล็อกอินสำเร็จ")
            time.sleep(5) # รอ Animation จบ
            return True
        except Exception as e:
            print(f"🛑 ล็อกอินล้มเหลว: {e}")
            return False

    def parse_values_smart(self, text):
        """ แกะค่าด้วย Regex ที่ครอบคลุมมากขึ้น """
        wind_val = "N/A"
        power_val = "N/A"
        
        # ลบช่องว่างแปลกๆ และ Newline
        clean_text = re.sub(r'\s+', ' ', text).strip()
        
        # --- Pattern สำหรับ Wind Speed ---
        # รองรับ: "Wind Speed 12.3", "WindSpeed:12.3", "12.3 m/s"
        patterns_wind = [
            r"Wind\s*Speed.*?(\d+\.?\d*)",  # Wind Speed นำหน้า
            r"(\d+\.?\d*)\s*m/s"            # หน่วย m/s ตามหลัง
        ]
        
        for p in patterns_wind:
            match = re.search(p, clean_text, re.IGNORECASE)
            if match:
                wind_val = float(match.group(1))
                break

        # --- Pattern สำหรับ Active Power ---
        # รองรับ: "Active Power 1500", "ActivePower:1500", "1500 kW"
        patterns_power = [
            r"Active\s*Power.*?(\d+\.?\d*)",
            r"(\d+\.?\d*)\s*kW"
        ]
        
        for p in patterns_power:
            match = re.search(p, clean_text, re.IGNORECASE)
            if match:
                power_val = float(match.group(1))
                break
                
        # ตัด Note ไม่ให้ยาวเกินไป
        debug_note = clean_text[:100] if (wind_val == "N/A" or power_val == "N/A") else "OK"
        return wind_val, power_val, debug_note

    def find_data_in_frames(self, driver):
        """ 
        Recursively ค้นหา Text ในทุก Frame 
        คืนค่า: (wind, power, note, success_boolean)
        """
        driver.switch_to.default_content()
        frames = driver.find_elements(By.TAG_NAME, "iframe")
        
        # ไล่หา Level 1
        for f1 in frames:
            driver.switch_to.default_content()
            try:
                driver.switch_to.frame(f1)
                body_text = driver.find_element(By.TAG_NAME, "body").get_attribute('innerText')
                
                # ถ้าเจอ keyword ให้ลอง parse เลย
                if "Wind" in body_text and "Power" in body_text:
                    w, p, n = self.parse_values_smart(body_text)
                    if w != "N/A": return w, p, n, True
                
                # ไล่หา Level 2 (Nested)
                child_frames = driver.find_elements(By.TAG_NAME, "iframe")
                for f2 in child_frames:
                    driver.switch_to.default_content()
                    driver.switch_to.frame(f1)
                    driver.switch_to.frame(f2)
                    
                    body_text_2 = driver.find_element(By.TAG_NAME, "body").get_attribute('innerText')
                    if "Wind" in body_text_2 or "kW" in body_text_2:
                        w, p, n = self.parse_values_smart(body_text_2)
                        return w, p, n, True
                        
            except Exception:
                continue
                
        return "N/A", "N/A", "Text Not Found in any Frame", False

    def save_data(self, data):
        """ บันทึก CSV และ GSheet """
        # CSV
        file_name = 'wind_scada_v37.csv'
        exists = os.path.isfile(file_name)
        try:
            with open(file_name, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                if not exists: writer.writerow(["Timestamp", "ID", "Wind", "Power", "Note"])
                writer.writerow([data['ts'], data['id'], data['w'], data['p'], data['n']])
        except IOError as e:
            print(f"      ⚠️ เขียน CSV ไม่ได้: {e}")

        # GSheet
        if self.sheet:
            try:
                self.sheet.append_row([data['ts'], data['id'], data['w'], data['p'], data['n']])
                print(f"      ☁️  อัปโหลด GSheet สำเร็จ")
            except Exception as e:
                print(f"      ⚠️ อัปโหลด GSheet พลาด: {e}")

    def run_cycle(self):
        print(f"\n📋 เริ่มรอบการทำงาน: {datetime.datetime.now()}")
        
        # ไปยังหน้า List Turbine
        if self.driver.current_url != CONFIG["TARGET_URL"]:
            self.driver.get(CONFIG["TARGET_URL"])
            time.sleep(5) # รอ redirect

        # เช็คว่าหลุด Login ไหม
        if "login" in self.driver.current_url:
            print("⚠️ Session หลุด! กำลัง Login ใหม่...")
            if not self.login(): return

        # รอ Frame รายชื่อโหลด
        try:
            wait = WebDriverWait(self.driver, 20)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "iframe")))
        except:
            print("❌ โหลดหน้ารายชื่อไม่สำเร็จ")
            return

        for idx, name in enumerate(CONFIG["TARGET_TURBINES"]):
            print(f"   👉 [{idx+1}/{len(CONFIG['TARGET_TURBINES'])}] กำลังดึงข้อมูล: {name}")
            
            # ต้อง Refresh หน้า List หรือกลับมาหน้า List ทุกครั้งเพื่อ Reset DOM
            if idx > 0:
                self.driver.get(CONFIG["TARGET_URL"])
                # รอ iFrame รายชื่อ
                WebDriverWait(self.driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "iframe")))

            try:
                # เข้า iFrame หลักของหน้ารายการ
                self.driver.switch_to.default_content()
                main_iframe = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.NAME, "app-portal-iframe"))
                )
                self.driver.switch_to.frame(main_iframe)
                
                # เข้า iFrame ย่อยที่มีปุ่ม (อาจต้องปรับ index ถ้าเปลี่ยน)
                sub_iframe = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "iframe"))
                )
                self.driver.switch_to.frame(sub_iframe)

                # กดปุ่ม Turbine
                xpath = f"//*[contains(text(), '{name}')]"
                btn = WebDriverWait(self.driver, 10).until(EC.element_to_be_clickable((By.XPATH, xpath)))
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", btn)
                btn.click()
                
                # รอโหลดข้อมูล (Smart Wait แทน sleep 25 วิ)
                # เราจะรอจนกว่าจะเจอ iFrame ใหม่ หรือ timeout 20 วิ
                time.sleep(5) # รอ animation เปลี่ยนหน้าสักนิด
                
                # เริ่มล่าข้อมูล
                max_retries = 3
                w, p, n = "N/A", "N/A", "Init"
                
                for attempt in range(max_retries):
                    print(f"      🕵️‍♂️ Scan รอบที่ {attempt+1}...")
                    w, p, n, success = self.find_data_in_frames(self.driver)
                    if success:
                        break
                    time.sleep(3) # ถ้าไม่เจอ รอ 3 วิแล้วหาใหม่ (เผื่อค่าเพิ่งมา)

                # บันทึก
                timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                print(f"      ✨ ผลลัพธ์: Wind={w} | Power={p}")
                
                self.save_data({
                    'ts': timestamp, 'id': name, 'w': w, 'p': p, 'n': n
                })

            except Exception as e:
                print(f"      💥 Error กับตู้ {name}: {e}")
                # traceback.print_exc() 

    def start(self):
        if self.login():
            while True:
                try:
                    self.run_cycle()
                except Exception as e:
                    print(f"❌ เกิดข้อผิดพลาดร้ายแรงใน Loop หลัก: {e}")
                    
                print(f"\n💤 จบรอบ... พัก {CONFIG['INTERVAL_MINUTES']} นาที")
                time.sleep(CONFIG['INTERVAL_MINUTES'] * 60)
        else:
            self.driver.quit()

if __name__ == "__main__":
    bot = ScadaBot()
    try:
        bot.start()
    except KeyboardInterrupt:
        print("\n🛑 หยุดทำงาน")
        bot.driver.quit()