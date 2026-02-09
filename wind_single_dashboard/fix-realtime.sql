-- ═══════════════════════════════════════════════════════════════
-- 🔧 Supabase Realtime Configuration Fix
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ═══════════════════════════════════════════════════════════════

-- 📋 Step 1: Check if table exists
SELECT 'Checking if wind_measurements table exists...' as step;
SELECT EXISTS (
   SELECT FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name = 'wind_measurements'
) as table_exists;

-- 📋 Step 2: Check current RLS status
SELECT 'Checking Row Level Security status...' as step;
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'wind_measurements';

-- 📋 Step 3: Check current policies
SELECT 'Checking RLS policies...' as step;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'wind_measurements';

-- 📋 Step 4: Check if Realtime is enabled
SELECT 'Checking Realtime publication...' as step;
SELECT * FROM pg_publication_tables
WHERE tablename = 'wind_measurements';

-- ═══════════════════════════════════════════════════════════════
-- 🔧 FIX 1: Enable Realtime on the table
-- ═══════════════════════════════════════════════════════════════

-- Add table to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE wind_measurements;

-- Verify
SELECT 'Verification: Is wind_measurements in publication?' as step;
SELECT * FROM pg_publication_tables
WHERE tablename = 'wind_measurements';

-- ═══════════════════════════════════════════════════════════════
-- 🔧 FIX 2: Disable RLS or Add Policies
-- ═══════════════════════════════════════════════════════════════

-- Option A: Disable RLS completely (simpler, less secure)
ALTER TABLE wind_measurements DISABLE ROW LEVEL SECURITY;

-- Option B: Keep RLS but allow public SELECT (more secure)
-- Uncomment these lines if you want to use Option B instead:
-- ALTER TABLE wind_measurements ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Allow public SELECT on wind_measurements"
-- ON wind_measurements
-- FOR SELECT
-- USING (true);
--
-- CREATE POLICY "Allow public INSERT on wind_measurements"
-- ON wind_measurements
-- FOR INSERT
-- WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 🔧 FIX 3: Grant permissions to anon role
-- ═══════════════════════════════════════════════════════════════

GRANT SELECT, INSERT ON wind_measurements TO anon;
GRANT SELECT, INSERT ON wind_measurements TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- ✅ Verification Query - Run this to confirm everything works
-- ═══════════════════════════════════════════════════════════════

SELECT 'Final verification...' as step;

SELECT
  'Table exists' as check_item,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'wind_measurements'
  ) as status
UNION ALL
SELECT
  'Realtime enabled' as check_item,
  EXISTS (
    SELECT FROM pg_publication_tables
    WHERE tablename = 'wind_measurements'
  ) as status
UNION ALL
SELECT
  'RLS disabled or policies exist' as check_item,
  (NOT (SELECT rowsecurity FROM pg_tables WHERE tablename = 'wind_measurements'))
  OR EXISTS (SELECT FROM pg_policies WHERE tablename = 'wind_measurements')
  as status;

-- ═══════════════════════════════════════════════════════════════
-- 📝 Expected Output:
-- ═══════════════════════════════════════════════════════════════
-- All rows should show 'true' in the status column:
--
-- check_item                        | status
-- ----------------------------------|-------
-- Table exists                      | true
-- Realtime enabled                  | true
-- RLS disabled or policies exist    | true
--
-- If any row shows 'false', there's still an issue!
-- ═══════════════════════════════════════════════════════════════
