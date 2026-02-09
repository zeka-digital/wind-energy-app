# Wind Dashboard - Real-time Features

## ฟีเจอร์ใหม่ที่เพิ่มเข้ามา

### 1. Real-time Data Updates
- ✅ ใช้ Supabase Realtime Channels
- ✅ ติดตามการเพิ่มข้อมูลใหม่ในตาราง `wind_measurements`
- ✅ อัปเดตค่า Active Power และ Wind Speed ทันทีที่มีข้อมูลใหม่

### 2. Timeline Graph
- ✅ แสดงกราฟแท่ง (Mini Bar Chart) ย้อนหลัง 5 รายการ
- ✅ แสดง Active Power และ Wind Speed แต่ละช่วงเวลา
- ✅ รองรับการเลื่อน (Scroll) ทั้งเมาส์และมือถือ

### 3. Historical Data Interaction
- ✅ คลิกที่กราฟเพื่อดูข้อมูลย้อนหลัง
- ✅ กังหัน 3D หมุนตามค่าในอดีต
- ✅ ค่า Active Power และ Wind Speed เปลี่ยนแปลงตามเวลาที่เลือก

### 4. Live/History Mode
- ✅ มีสถานะบอกว่ากำลังดู "LIVE" หรือ "History"
- ✅ ปุ่ม "Back to LIVE" สำหรับกลับมาดูข้อมูลปัจจุบัน
- ✅ ตัวบ่งชี้ LIVE แบบ real-time (มีจุดกระพริบสีเขียว)

### 5. No Cache Data Fetching
- ✅ ปิด Cache ในการดึงข้อมูล
- ✅ ใช้ `cache: 'no-store'` และ `revalidate: 0`
- ✅ รับข้อมูลใหม่ทุกครั้งที่โหลดหน้าเว็บ

## การติดตั้งและใช้งาน

### 1. ติดตั้ง Dependencies

```bash
npm install @supabase/supabase-js
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` และใส่ค่า Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Database Schema

ตรวจสอบว่าตาราง `wind_measurements` มี schema ดังนี้:

```sql
CREATE TABLE wind_measurements (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  turbine_name TEXT NOT NULL,
  active_power NUMERIC NOT NULL,
  wind_speed NUMERIC NOT NULL
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE wind_measurements;
```

### 4. รัน Development Server

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

## วิธีใช้งาน

### การดูข้อมูล Real-time
1. เมื่อมีข้อมูลใหม่จาก Scraper เข้า Database
2. Dashboard จะอัปเดตข้อมูลทันทีโดยอัตโนมัติ
3. ตัวบ่งชี้ "LIVE" สีเขียวจะกระพริบแสดงสถานะ

### การดูข้อมูลย้อนหลัง
1. เลื่อน Timeline ที่ด้านล่างหน้าจอ
2. คลิกที่แท่งกราฟที่ต้องการดู
3. กังหัน 3D และค่าต่างๆ จะเปลี่ยนตามข้อมูลในเวลานั้น
4. สถานะจะเปลี่ยนเป็น "History"

### การกลับสู่ Live Mode
1. คลิกปุ่ม "Back to LIVE" ที่ Info Panel (Desktop)
2. หรือคลิกปุ่ม "▶ LIVE" ที่ Bottom Bar (Mobile/Desktop)

## โครงสร้างไฟล์ที่เพิ่มเข้ามา

```
wind_single_dashboard/
├── lib/
│   └── supabase.ts              # Supabase client configuration
├── app/
│   ├── api/
│   │   └── wind-data/
│   │       └── route.ts         # API route (ปรับให้ใช้ Supabase)
│   └── 3d-dashboard/
│       ├── page.tsx             # Dashboard หลัก (เพิ่ม Real-time + Timeline)
│       └── Timeline.tsx         # Timeline component (ใหม่)
├── .env.local                   # Environment variables (สร้างใหม่)
└── .env.example                 # ตัวอย่าง env variables

```

## API Response Format

### เดิม (CSV-based)
```json
{
  "file": "2026-02-08.csv",
  "turbineCount": 10,
  "turbines": [
    {
      "name": "WT01",
      "activePower": 1500,
      "windSpeed": 8.5,
      "timestamp": "2026-02-08T10:30:00"
    }
  ]
}
```

### ใหม่ (Supabase-based with History)
```json
{
  "turbineCount": 10,
  "turbines": [
    {
      "name": "WT01",
      "current": {
        "id": 123,
        "name": "WT01",
        "activePower": 1500,
        "windSpeed": 8.5,
        "timestamp": "2026-02-08T10:30:00"
      },
      "history": [
        { "id": 119, "activePower": 1400, "windSpeed": 8.0, "timestamp": "..." },
        { "id": 120, "activePower": 1450, "windSpeed": 8.2, "timestamp": "..." },
        { "id": 121, "activePower": 1480, "windSpeed": 8.3, "timestamp": "..." },
        { "id": 122, "activePower": 1490, "windSpeed": 8.4, "timestamp": "..." },
        { "id": 123, "activePower": 1500, "windSpeed": 8.5, "timestamp": "..." }
      ]
    }
  ]
}
```

## Troubleshooting

### ข้อมูลไม่อัปเดต Real-time
1. ตรวจสอบ Supabase credentials ใน `.env.local`
2. เช็คว่า Realtime เปิดอยู่ที่ Supabase Dashboard
3. ดู Console logs เพื่อดูข้อผิดพลาด

### Timeline ไม่แสดง
1. ตรวจสอบว่ามีข้อมูลอย่างน้อย 2 รายการใน Database
2. เช็คว่า API response มี `history` array

### กังหันไม่หมุนตามข้อมูลอดีต
1. ตรวจสอบว่า Scene component รับ props `turbines` ที่เป็น `displayData`
2. เช็คว่า `selectedHistoryIndex` ถูกส่งไปยัง Timeline component

## Performance Tips

- Timeline จะแสดงเฉพาะ 5 รายการล่าสุดเพื่อประสิทธิภาพ
- Real-time subscription จะ refetch เฉพาะเมื่อมี INSERT event
- Cache ถูกปิดการใช้งานเพื่อให้ได้ข้อมูลใหม่เสมอ

## Credits

Built with:
- Next.js 16.1.6
- React Three Fiber (3D visualization)
- Supabase (Real-time database)
- Tailwind CSS (Styling)
