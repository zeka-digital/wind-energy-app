# 🔍 Realtime Connection Checklist

## ตรวจสอบทีละข้อ:

### ✅ 1. Supabase Credentials
```bash
# ตรวจสอบ .env.local
cat .env.local

# ต้องเห็น:
NEXT_PUBLIC_SUPABASE_URL=https://hxgqzxfshumcntgvxyag.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (ยาวมาก 200+ ตัวอักษร)
```

**ถ้า Key สั้น (เช่น `sb_publishable...`) = ❌ ผิด!**
- ไปหา Key ใหม่ที่: https://supabase.com/dashboard/project/hxgqzxfshumcntgvxyag/settings/api
- Copy "anon public" key

---

### ✅ 2. Realtime Publication
```sql
-- รันใน Supabase SQL Editor
SELECT * FROM pg_publication_tables
WHERE tablename = 'wind_measurements';

-- ต้องเห็น 1 แถว (ถ้าไม่มี = Realtime ยังไม่เปิด)
```

**ถ้าไม่มี = ❌ ยังไม่เปิด Realtime!**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE wind_measurements;
```

---

### ✅ 3. Row Level Security (RLS)
```sql
-- ตรวจสอบ RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'wind_measurements';

-- ถ้า rowsecurity = true → ต้องมี Policies หรือปิด RLS
```

**แก้ไข:**
```sql
-- Option A: ปิด RLS (ง่ายสุด)
ALTER TABLE wind_measurements DISABLE ROW LEVEL SECURITY;

-- Option B: เพิ่ม Policies (ปลอดภัยกว่า)
CREATE POLICY "Allow public SELECT" ON wind_measurements
FOR SELECT USING (true);

CREATE POLICY "Allow public INSERT" ON wind_measurements
FOR INSERT WITH CHECK (true);
```

---

### ✅ 4. Permissions
```sql
-- Grant permissions to anon role
GRANT SELECT, INSERT ON wind_measurements TO anon;
GRANT SELECT, INSERT ON wind_measurements TO authenticated;
```

---

### ✅ 5. Test Connection (Node.js)
```bash
# ติดตั้ง package ก่อน (ถ้ายังไม่มี)
npm install @supabase/supabase-js

# รัน Test Script
node test-realtime.js

# ต้องเห็น:
✅ API connection successful!
✅ REALTIME CONNECTED!
🔍 Listening for INSERT events...
```

---

### ✅ 6. Test from Dashboard
```bash
# Start Dashboard
npm run dev

# เปิด http://localhost:3000/3d-dashboard
# กด F12 → Console
# ต้องเห็น:
✅ REALTIME CONNECTED! Listening for INSERT events...
```

---

### ✅ 7. Test with Scraper
```bash
# Terminal ใหม่
cd ../enos_scraper
source venv/bin/activate
python singletarget_v2.py

# รอ 20-30 วินาที
# ดู Console บน Dashboard ต้องเห็น:
🔴 REAL-TIME MESSAGE RECEIVED!
📊 New Data: { turbine_name: "WA101", ... }
```

---

## 🚨 Common Issues:

### ❌ Issue 1: "CHANNEL_ERROR"
**สาเหตุ:** Realtime ยังไม่เปิดบนตาราง
**แก้:** รัน `ALTER PUBLICATION supabase_realtime ADD TABLE wind_measurements;`

### ❌ Issue 2: "TIMED_OUT"
**สาเหตุ:** Network หรือ Firewall block WebSocket
**แก้:** ลอง VPN หรือเปลี่ยน Network

### ❌ Issue 3: Console ไม่แสดงอะไรเลย
**สาเหตุ:** Anon Key ผิด หรือ RLS block
**แก้:** เช็ค .env.local และรัน SQL Fix

### ❌ Issue 4: API ทำงาน แต่ Realtime ไม่ทำงาน
**สาเหตุ:** Publication ไม่ครบ หรือ RLS ไม่มี Policy
**แก้:** รัน `fix-realtime.sql` ทั้งหมด

---

## 📞 Need Help?

ถ้าทำตาม Checklist แล้วยังไม่ได้ ให้ส่งข้อมูลนี้มา:

1. **Console Log:**
   ```
   (คัดลอกทั้งหมดจาก Console)
   ```

2. **SQL Query Results:**
   ```sql
   SELECT * FROM pg_publication_tables WHERE tablename = 'wind_measurements';
   SELECT rowsecurity FROM pg_tables WHERE tablename = 'wind_measurements';
   ```

3. **.env.local (first 50 chars of key only):**
   ```
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci... (first 50 chars)
   ```
