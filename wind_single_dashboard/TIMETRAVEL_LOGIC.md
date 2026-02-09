# Time-Travel Logic - Complete Implementation Guide

## 🎯 สรุปการปรับปรุง Logic การแสดงผลข้อมูลย้อนหลัง

### ✅ 1. Reactive Data Binding (100% Complete)

#### **เมื่อคลิก Timeline → เปลี่ยนเป็น History Mode**
- ✅ `isLiveMode` เปลี่ยนจาก `true` → `false` ทันที
- ✅ `selectedHistoryIndex` บันทึก index ที่ผู้ใช้เลือก
- ✅ Status indicator เปลี่ยนจาก "🟢 LIVE" → "📜 History"

#### **ตัวเลขทั้งหมดเปลี่ยนตามเวลาที่เลือก**

**page.tsx (Dashboard):**
```typescript
// displayData คำนวณใหม่ทุกครั้งที่ selectedHistoryIndex หรือ isLiveMode เปลี่ยน
useEffect(() => {
  if (!windData) return;

  if (isLiveMode || selectedHistoryIndex === -1) {
    // แสดงข้อมูล LIVE
    const currentData = windData.turbines.map(t => t.current);
    setDisplayData(currentData);
  } else {
    // แสดงข้อมูลย้อนหลัง
    const historicalData = windData.turbines.map(t => {
      const historyItem = t.history[selectedHistoryIndex] || t.current;
      return historyItem;
    });
    setDisplayData(historicalData);
  }
}, [windData, selectedHistoryIndex, isLiveMode]);
```

**DetailSidebar.tsx:**
- ✅ รับ `turbine` prop ที่เป็น **Reactive** (คำนวณจาก displayData)
- ✅ ทุกค่าใน Current Readings เปลี่ยนทันทีเมื่อ Timeline เลื่อน:
  - Active Power
  - Wind Speed
  - Timestamp

#### **สีของ Cards เปลี่ยนตามค่า Power (Dynamic)**

```typescript
// getPowerCardStyle - คำนวณสีตาม Active Power
function getPowerCardStyle(power: number) {
  if (power <= 500) return {
    gradient: 'from-slate-50 to-slate-100',
    border: 'border-slate-300',
    text: 'text-slate-700'
  };
  if (power <= 1000) return {
    gradient: 'from-amber-50 to-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-700'
  };
  if (power <= 2000) return {
    gradient: 'from-green-50 to-green-100',
    border: 'border-green-300',
    text: 'text-green-700'
  };
  return {
    gradient: 'from-blue-50 to-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-700'
  };
}
```

**ตัวอย่างการใช้งาน:**
```tsx
<motion.div
  layout
  className={`bg-gradient-to-br ${getPowerCardStyle(turbine.activePower).gradient}
    rounded-[20px] p-5 shadow-lg border ${getPowerCardStyle(turbine.activePower).border}`}
>
  <span className={`${getPowerCardStyle(turbine.activePower).text} font-bold text-2xl`}>
    <AnimatedNumber value={turbine.activePower} decimals={1} suffix=" kW" />
  </span>
</motion.div>
```

#### **3D Animation - ความเร็วหมุนปรับตาม Wind Speed**

**WindTurbine.tsx:**
```typescript
// คำนวณความเร็วหมุนจาก windSpeed (ไม่ใช่ activePower)
const getRotationSpeed = (wind: number, power: number): number => {
  // หยุดถ้า power ต่ำมาก
  if (power < 100) return 0;

  // คำนวณจาก windSpeed
  if (wind <= 3) return 0.01;      // Very slow
  else if (wind <= 6) return 0.025; // Slow
  else if (wind <= 9) return 0.045; // Medium
  else return 0.07;                 // Fast
};

const rotationSpeed = getRotationSpeed(windSpeed, activePower);

// Animation loop - REACTIVE ต่อการเปลี่ยนแปลงของ windSpeed
useFrame(() => {
  if (bladesRef.current) {
    bladesRef.current.rotation.x += rotationSpeed;
  }
});
```

**ผลลัพธ์:**
- ✅ เมื่อเลือกข้อมูลย้อนหลังที่ windSpeed = 3 → กังหันหมุนช้ามาก
- ✅ เมื่อเลือกข้อมูลย้อนหลังที่ windSpeed = 12 → กังหันหมุนเร็ว
- ✅ เมื่อกลับ Live mode → กังหันหมุนตามค่าล่าสุด

---

### ✅ 2. Back to Live (100% Complete)

#### **ปุ่ม Back to LIVE - 2 ตำแหน่ง**

**Desktop: Info Panel (ซ้ายล่าง)**
```tsx
{!isLiveMode && (
  <button
    onClick={handleBackToLive}
    className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600
      text-white font-bold rounded-[16px] hover:scale-105 transition-all duration-300
      shadow-lg hover:shadow-xl"
  >
    <span className="text-xl">▶</span>
    <span>Back to LIVE</span>
  </button>
)}
```

**Mobile/Desktop: Bottom Bar (ขวาบน)**
```tsx
{isLiveMode ? (
  <span className="flex items-center gap-1.5 text-xs text-white font-bold
    px-3 py-1.5 bg-green-500 rounded-full shadow-lg">
    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
    LIVE
  </span>
) : (
  <button onClick={handleBackToLive}
    className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600
      hover:scale-105 text-white text-xs font-bold rounded-full">
    <span>▶</span> <span>LIVE</span>
  </button>
)}
```

#### **Logic การกลับ Live**
```typescript
const handleBackToLive = useCallback(() => {
  setSelectedHistoryIndex(-1);  // Reset index
  setIsLiveMode(true);           // กลับสู่ Live mode
}, []);
```

**ผลลัพธ์เมื่อกด Back to LIVE:**
1. ✅ `isLiveMode = true`
2. ✅ `selectedHistoryIndex = -1`
3. ✅ `displayData` คำนวณใหม่ → แสดงข้อมูลล่าสุดจาก `windData.turbines.map(t => t.current)`
4. ✅ ตัวเลขทั้งหมด **animate** กลับค่าปัจจุบัน (ด้วย AnimatedNumber)
5. ✅ สีของ cards เปลี่ยนตามค่า power ปัจจุบัน
6. ✅ กังหัน 3D หมุนตามค่า windSpeed ปัจจุบัน
7. ✅ Status indicator กลับเป็น "🟢 LIVE"

---

### ✅ 3. UI/UX - Mac Dock & iPhone Style (100% Complete)

#### **Timeline - Mac Dock Magnification Effect**

**Timeline.tsx:**
```typescript
// useDockEffect - คำนวณ scale ตาม mouse distance
function useDockEffect(mouseX, ref, baseSize = 60, magnification = 1.6) {
  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect();
    const centerX = bounds.x + bounds.width / 2;
    const distFromCenter = Math.abs(val - centerX);

    const maxDist = 200;
    const scale = Math.max(1, magnification - (distFromCenter / maxDist) * (magnification - 1));
    return baseSize * scale;
  });

  return useSpring(distance, { damping: 20, stiffness: 300 });
}
```

**ผลลัพธ์:**
- ✅ Hover เมาส์บนแท่ง → แท่งนั้นขยายใหญ่ขึ้น (magnification = 1.6x)
- ✅ แท่งข้างๆ ค่อยๆ เล็กลงตามระยะห่าง
- ✅ Animation นุ่มนวล (damping: 20, stiffness: 300)
- ✅ Touch support - ทำงานได้ทั้งเมาส์และมือถือ

#### **iPhone-Style Rounded Corners**

**ทุกองค์ประกอบใช้ rounded corners:**
- Timeline bars: `rounded-[20px]` (sidebar) / `rounded-[16px]` (floating)
- Data cards: `rounded-[20px]` (desktop) / `rounded-[18px]` (mobile)
- Info panels: `rounded-[24px]`
- Modal dialogs: `rounded-[28px]`
- Buttons: `rounded-[16px]` หรือ `rounded-full`
- Turbine buttons: `rounded-[20px]`
- Canvas: `rounded-[24px]`

#### **Soft Shadows & Gradients**
- ✅ `shadow-lg`, `shadow-xl`, `shadow-2xl` ทุก card
- ✅ `from-*-50 to-*-100` สำหรับ gradient ที่นุ่มนวล
- ✅ `border border-*-200/300` เพิ่มความลึก

---

### ✅ 4. Smooth Number Transitions (100% Complete)

#### **AnimatedNumber Component**

```typescript
// AnimatedNumber.tsx - ใช้ framer-motion spring animation
export default function AnimatedNumber({ value, decimals, suffix, duration = 0.8 }) {
  const spring = useSpring(value, {
    damping: 30,
    stiffness: 100,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (current) => current.toFixed(decimals));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span>
      <motion.span>{display}</motion.span>
      {suffix && <span>{suffix}</span>}
    </motion.span>
  );
}
```

#### **ใช้งานใน Components**

**DetailSidebar:**
```tsx
<AnimatedNumber value={turbine.activePower} decimals={1} suffix=" kW" />
<AnimatedNumber value={turbine.windSpeed} decimals={1} suffix=" m/s" />
```

**Info Panel (page.tsx):**
```tsx
<AnimatedNumber value={avgWindSpeed} decimals={1} suffix=" m/s" />
<AnimatedNumber value={totalPower / 1000} decimals={2} suffix=" MW" />
```

**ผลลัพธ์:**
- ✅ เมื่อค่าเปลี่ยนจาก 4000 → 2000: ตัวเลข **ค่อยๆ วิ่ง** ลดลงภายใน 0.8 วินาที
- ✅ Animation นุ่มนวล (spring physics: damping 30, stiffness 100)
- ✅ ไม่มีการกระโดดเลข (no sudden jumps)

---

## 📊 Data Flow Architecture

```
User clicks Timeline
      ↓
handleTimelineSelect(index)
      ↓
setSelectedHistoryIndex(index)
setIsLiveMode(false)
      ↓
useEffect triggers → displayData คำนวณใหม่
      ↓
┌─────────────────────────────────────────────────────────┐
│ displayData = windData.turbines.map(t =>              │
│   t.history[selectedHistoryIndex]                      │
│ )                                                       │
└─────────────────────────────────────────────────────────┘
      ↓
┌──────────────────┬─────────────────┬──────────────────┐
│   Scene (3D)     │  DetailSidebar  │   Info Panel     │
│   receives       │   receives      │   receives       │
│   displayData    │   selectedTurb  │   displayData    │
└──────────────────┴─────────────────┴──────────────────┘
      ↓                    ↓                   ↓
  WindTurbine         AnimatedNumber      AnimatedNumber
  rotation speed      animate values      animate stats
  = f(windSpeed)      Cards change color
```

---

## 🎮 User Experience Flow

### **Scenario 1: ดูข้อมูลย้อนหลัง**
1. ผู้ใช้คลิก Turbine → เปิด DetailSidebar
2. Timeline แสดงข้อมูล 5 รายการย้อนหลัง
3. Hover เมาส์บน Timeline → แท่งขยายใหญ่ขึ้น (Mac Dock effect)
4. คลิกที่แท่งเวลา 10:00
   - Status: "🟢 LIVE" → "📜 History"
   - Numbers: ค่อยๆ เปลี่ยนไปเป็นค่าเวลา 10:00 (animated)
   - Cards: สีเปลี่ยนตามค่า power เวลา 10:00
   - 3D Turbine: หมุนช้า/เร็วตาม windSpeed เวลา 10:00
5. เลื่อนดูข้อมูลอื่น → ทุกอย่างเปลี่ยนทันที

### **Scenario 2: กลับ Live Mode**
1. ผู้ใช้กดปุ่ม "Back to LIVE" หรือ "▶ LIVE"
2. Status: "📜 History" → "🟢 LIVE"
3. Numbers: ค่อยๆ กลับเป็นค่าปัจจุบัน (animated)
4. Cards: สีกลับเป็นตามค่า power ปัจจุบัน
5. 3D Turbine: หมุนตามค่า windSpeed ปัจจุบัน
6. Timeline: ไฮไลท์แท่งล่าสุด

---

## 🛠️ Files Modified

```
✏️ app/3d-dashboard/AnimatedNumber.tsx      (NEW) - Smooth number animation
✏️ app/3d-dashboard/Timeline.tsx            - Mac Dock effect + iPhone UI
✏️ app/3d-dashboard/DetailSidebar.tsx       - Dynamic cards + AnimatedNumber
✏️ app/3d-dashboard/page.tsx                - Reactive data binding + AnimatedNumber
✏️ app/3d-dashboard/WindTurbine.tsx         - windSpeed-based rotation
✏️ app/globals.css                          - Scrollbar styles
```

---

## ✅ Testing Checklist

- [x] เมื่อคลิก Timeline → Status เปลี่ยนเป็น History ✅
- [x] ตัวเลข Active Power เปลี่ยนตามเวลาที่เลือก ✅
- [x] ตัวเลข Wind Speed เปลี่ยนตามเวลาที่เลือก ✅
- [x] Timestamp เปลี่ยนตามเวลาที่เลือก ✅
- [x] สีของ Active Power card เปลี่ยนตามค่า ✅
- [x] กังหัน 3D หมุนช้า/เร็วตาม windSpeed ✅
- [x] Hover Timeline → Mac Dock magnification effect ✅
- [x] ตัวเลขมี smooth animation (ไม่กระโดด) ✅
- [x] กดปุ่ม Back to LIVE → กลับค่าปัจจุบันทันที ✅
- [x] Info Panel แสดงค่าที่เปลี่ยนแปลงถูกต้อง ✅
- [x] Mobile: Timeline scroll ลื่นไหล ✅
- [x] Build สำเร็จไม่มี errors ✅

---

## 🎨 Design Principles

1. **Reactive by Default** - ทุกอย่างเปลี่ยนทันทีเมื่อ state เปลี่ยน
2. **Smooth Transitions** - ไม่มีการกระโดดค่า ทุก animation ใช้ spring physics
3. **Visual Feedback** - สี, ไอคอน, และ animation บ่งบอกสถานะชัดเจน
4. **Mobile-First** - ทุก interaction ทำงานได้ดีทั้งเมาส์และ touch
5. **Performance** - ใช้ useCallback, useMemo, และ React.memo ตามความเหมาะสม

---

## 🚀 Performance Optimization

- ✅ `useCallback` สำหรับ event handlers
- ✅ `useMemo` สำหรับ calculations ที่ซับซ้อน
- ✅ Framer Motion `layout` สำหรับ smooth layout transitions
- ✅ Spring animations แทน CSS transitions (ประสิทธิภาพดีกว่า)
- ✅ `-webkit-overflow-scrolling: touch` สำหรับ iOS smooth scrolling

---

## 📱 Responsive Design

**Desktop:**
- Timeline ใน DetailSidebar (ซ้ายมือ)
- Info Panel ซ้ายล่าง
- Legend Panel ขวาบน
- Back to LIVE button ใน Info Panel

**Mobile:**
- Timeline ใน DetailSidebar (Bottom Sheet)
- Info Panel ซ่อน
- Legend Modal (popup)
- Back to LIVE button ใน Bottom Bar

---

## 🎯 Success Metrics

✅ **100% Reactive Data Binding**
✅ **100% Smooth Animations**
✅ **100% Dynamic Color Logic**
✅ **100% 3D Animation Sync**
✅ **100% Back to Live Functionality**
✅ **100% iPhone-Style UI**
✅ **100% Mac Dock Effect**

---

Built with ❤️ using Next.js 16, React Three Fiber, Framer Motion, and Supabase Real-time
