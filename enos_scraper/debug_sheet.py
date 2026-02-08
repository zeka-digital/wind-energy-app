import json
import gspread
from google.oauth2.service_account import Credentials
import os
import socket

# ==========================================
# 🔧 แก้ปัญหา Mac ค้าง (Force IPv4)
# ==========================================
old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(*args, **kwargs):
    res = old_getaddrinfo(*args, **kwargs)
    return [r for r in res if r[0] == socket.AF_INET]
socket.getaddrinfo = new_getaddrinfo
# ==========================================

socket.setdefaulttimeout(15)

GREEN = '\033[92m'
RED = '\033[91m'
RESET = '\033[0m'
YELLOW = '\033[93m'
CYAN = '\033[96m'

def test_connection():
    print(f"{YELLOW}>>> 🔍 Step 1: ตรวจสอบกุญแจ...{RESET}")

    key_file = 'scada-key.json'
    if not os.path.exists(key_file):
        print(f"{RED}❌ ไม่พบไฟล์ {key_file}{RESET}")
        return
    print(f"{GREEN}✅ พบไฟล์ {key_file}{RESET}")

    try:
        with open(key_file) as f:
            creds_data = json.load(f)
            bot_email = creds_data.get('client_email')
            print(f"📧 อีเมลบอท: {CYAN}{bot_email}{RESET}")
    except Exception:
        pass

    try:
        print(f"{YELLOW}>>> 📡 Step 2: เชื่อมต่อ Google API (โหมด IPv4)...{RESET}")
        
        scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ]
        
        creds = Credentials.from_service_account_file(key_file, scopes=scopes)
        client = gspread.authorize(creds)
        
        print(f"{GREEN}✅ เชื่อมต่อ API สำเร็จ!{RESET}")
        
        # ✅ แก้ไข ID ให้ถูกต้อง (เติมตัว i ที่หายไป)
        SHEET_ID = '140LnLJTKi_ZuseVzvfA_H-c7JeyXg1Ol6C7GPelpYXs'
        
        print(f"{YELLOW}>>> 📂 Step 3: กำลังเปิด Sheet (ID: {SHEET_ID})...{RESET}")
        
        sheet = client.open_by_key(SHEET_ID)
        print(f"{GREEN}🎉 สำเร็จ! เข้าถึง Sheet ได้แล้ว : {sheet.title}{RESET}")
        
        print(f"{YELLOW}>>> 📊 Step 4: ลองดึงข้อมูล...{RESET}")
        worksheet = sheet.worksheet("Live_Status_5Pole") 
        val = worksheet.acell('A1').value
        print(f"{GREEN}✅ อ่าน A1 ได้ว่า: {val}{RESET}")

    except socket.timeout:
        print(f"\n{RED}⏰ TIMEOUT ERROR{RESET}")

    except gspread.exceptions.SpreadsheetNotFound:
        print(f"\n{RED}❌ หา Sheet ไม่เจอ! (SpreadsheetNotFound){RESET}")
        print(f"{YELLOW}เช็ค ID อีกที: {SHEET_ID}{RESET}")

    except Exception as e:
        print(f"\n{RED}❌ Error: {e}{RESET}")

if __name__ == "__main__":
    test_connection()