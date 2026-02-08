from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
from datetime import datetime

# ส่วนของการเชื่อมต่อ InfluxDB
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

# =================ตั้งค่า InfluxDB=================
INFLUX_URL = "https://us-east-1-1.aws.cloud2.influxdata.com"
INFLUX_TOKEN = "yLzZvdLISjjk3kbVxGSiYaA8O9pCL-tWUj79LXx2-cwG6kHSXLbGXdtQLg-56PAHOPv1Xe2WEzjmtkuQGcmikA=="
INFLUX_ORG = "seesico@gmail.com"
INFLUX_BUCKET = "wind_energy"

# =================ตั้งค่าเว็บ EnOS=================
LOGIN_URL = "https://app-portal-eu.enos-iot.com/login"
USERNAME = "dev@impactelectrons.com"
PASSWORD = "7GE6gCLwM9XWfORfsCNG"

# =================ตั้งค่าเป้าหมาย (แก้ตรงนี้)=================

# 1. รายชื่อเสาที่ต้องการเก็บ (เพิ่มลดได้ตามใจ)
TURBINE_LIST = ["WA101", "WA102", "WA103", "WA104", "WA105"]

# 2. เวลาพักระหว่างรอบ (วินาที) -> 3 นาที = 180
SLEEP_INTERVAL = 180 

# 3. XPath ของปุ่มเลือกเสา (ใช้ %s แทนชื่อเสา เพื่อให้บอทเปลี่ยนชื่อไปเรื่อยๆ)
# แนะนำ: ใช้ text() จะแม่นยำที่สุด
# ตัวอย่าง: "//div[contains(text(), '%s')]"  <-- %s จะถูกแทนที่ด้วย WA101, WA102...
SELECTOR_BUTTON_TEMPLATE = "//div[contains(text(), '%s')]"

# 4. XPath ข้อมูลข้างใน (น่าจะเหมือนกันทุกเสา)
SELECTOR_POWER = "//*[@id='app']/div/div[2]/div[3]/ul/li[1]/span[2]" 
SELECTOR_WIND = ""

def setup_influx():
    try:
        client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
        write_api = client.write_api(write_options=SYNCHRONOUS)
        return write_api
    except:
        return None

def setup_driver():
    options = webdriver.ChromeOptions()
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.maximize_window()
    return driver

def login(driver):
    print(f"🚀 เข้าเว็บ: {LOGIN_URL}")
    driver.get(LOGIN_URL)
    wait = WebDriverWait(driver, 20)
    try:
        user_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text']"))) 
        pass_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        btn_login = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

        user_input.clear()
        user_input.send_keys(USERNAME)
        pass_input.clear()
        pass_input.send_keys(PASSWORD)
        btn_login.click()
        
        print("⏳ รอโหลดหน้าแรก (20 วินาที)...")
        time.sleep(20)
    except Exception as e:
        print(f"❌ ล็อกอินพลาด: {e}")

def get_text_from_selector(driver, selector):
    try:
        # พยายามหา element โดยรอสูงสุด 5 วินาที
        wait = WebDriverWait(driver, 5)
        element = wait.until(EC.visibility_of_element_located((By.XPATH, selector)))
        
        text_value = element.text
        clean_text = text_value.replace(",", "").replace("kW", "").replace("m/s", "").replace(" ", "")
        return float(clean_text)
    except:
        return 0.0

def process_turbine(driver, write_api, turbine_name):
    """เข้าไปเจาะข้อมูลทีละต้น"""
    print(f"   📍 กำลังไปที่เสา: {turbine_name}")
    
    # สร้าง XPath สำหรับปุ่มเสานี้โดยเฉพาะ (แทนที่ %s ด้วยชื่อเสา)
    btn_xpath = SELECTOR_BUTTON_TEMPLATE % turbine_name
    
    try:
        # 1. คลิกปุ่มเสา
        wait = WebDriverWait(driver, 10)
        btn = wait.until(EC.element_to_be_clickable((By.XPATH, btn_xpath)))
        btn.click()
        
        # 2. เช็คว่าเปิด Tab ใหม่ หรือ หน้าเดิม?
        # (ถ้าระบบเปิด Tab ใหม่ เราต้องสลับไป Tab นั้น)
        if len(driver.window_handles) > 1:
            driver.switch_to.window(driver.window_handles[-1])
            time.sleep(3) # รอโหลด
        else:
            time.sleep(5) # รอโหลดหน้าเดิม

        # 3. ดูดข้อมูล
        if "ใส่_XPath" in SELECTOR_POWER:
            import random
            power_val = random.uniform(50.0, 100.0) # Mock
            wind_val = random.uniform(2.0, 15.0)   # Mock
        else:
            power_val = get_text_from_selector(driver, SELECTOR_POWER)
            wind_val = get_text_from_selector(driver, SELECTOR_WIND)
            
        print(f"      📊 {turbine_name} -> ไฟ: {power_val:.2f} | ลม: {wind_val:.2f}")

        # 4. ส่งข้อมูล
        point = Point("turbine_status") \
            .tag("turbine_id", turbine_name) \
            .field("power_output", float(power_val)) \
            .field("wind_speed", float(wind_val)) \
            .time(datetime.utcnow())

        if write_api:
            write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)

        # 5. ปิดงาน (ถอยกลับ หรือ ปิด Tab)
        if len(driver.window_handles) > 1:
            driver.close() # ปิด Tab
            driver.switch_to.window(driver.window_handles[0]) # กลับมา Tab หลัก
        else:
            # ถ้าหน้าเว็บไม่มีปุ่ม Back ให้กด Browser Back
            driver.back() 
            time.sleep(3) # รอหน้าหลักโหลดคืน

    except Exception as e:
        print(f"      ❌ เกิดปัญหาที่เสา {turbine_name}: {e}")
        # ถ้าพัง ให้พยายามกลับหน้าหลัก
        try:
            if len(driver.window_handles) > 1:
                driver.close()
                driver.switch_to.window(driver.window_handles[0])
            else:
                driver.get(LOGIN_URL) # กลับไปตั้งหลักหน้าแรก
                time.sleep(10)
        except:
            pass

def main_loop(driver, write_api):
    round_count = 1
    try:
        while True:
            print(f"\n🔄 เริ่มรอบที่ {round_count} (เก็บ {len(TURBINE_LIST)} ต้น)")
            
            # วนลูปรายชื่อเสา ทีละต้น
            for turbine in TURBINE_LIST:
                process_turbine(driver, write_api, turbine)
                
            print(f"✅ จบรอบที่ {round_count}")
            print(f"💤 พักเครื่อง {SLEEP_INTERVAL/60:.0f} นาที...")
            time.sleep(SLEEP_INTERVAL)
            round_count += 1
            
            # รีเฟรชหน้าจอหลักสักครั้ง เพื่ออัปเดตสถานะ
            if len(driver.window_handles) == 1:
                driver.refresh()
                time.sleep(10)

    except KeyboardInterrupt:
        print("\n🛑 หยุดการทำงาน")

def main():
    write_api = setup_influx()
    driver = setup_driver()
    try:
        login(driver)
        main_loop(driver, write_api)
    finally:
        driver.quit()

if __name__ == "__main__":
    main()