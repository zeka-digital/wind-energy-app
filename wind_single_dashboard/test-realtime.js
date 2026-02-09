// ═══════════════════════════════════════════════════════════════
// 🧪 Supabase Realtime Test Script
// ═══════════════════════════════════════════════════════════════
// Run this with: node test-realtime.js
// Make sure you have @supabase/supabase-js installed:
// npm install @supabase/supabase-js
// ═══════════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');

  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      SUPABASE_URL = line.split('=')[1].trim();
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      SUPABASE_ANON_KEY = line.split('=')[1].trim();
    }
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Supabase Realtime Connection Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('Make sure .env.local contains:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=your_url');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`📡 Supabase URL: ${SUPABASE_URL}`);
console.log(`🔑 Anon Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 Test 1: API Connection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { data, error, count } = await supabase
      .from('wind_measurements')
      .select('*', { count: 'exact', head: false })
      .limit(5);

    if (error) {
      console.error('❌ API Error:', error.message);
      console.error('💡 Possible fixes:');
      console.error('   1. Check your SUPABASE_ANON_KEY is correct');
      console.error('   2. Check table permissions (RLS policies)');
      console.error('   3. Make sure wind_measurements table exists');
      return false;
    }

    console.log(`✅ API connection successful!`);
    console.log(`📊 Found ${count} total records in wind_measurements`);
    console.log(`📦 Sample data (latest 5 records):`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    return false;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📡 Test 2: Realtime Subscription');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const channel = supabase
    .channel('test_realtime_channel', {
      config: {
        broadcast: { self: false },
        presence: { key: '' },
      },
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'wind_measurements',
      },
      (payload) => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 REALTIME MESSAGE RECEIVED!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 Full Payload:', JSON.stringify(payload, null, 2));
        console.log('📊 New Data:', payload.new);
        console.log('🏷️ Turbine Name:', payload.new.turbine_name);
        console.log('⚡ Active Power:', payload.new.active_power, 'kW');
        console.log('🌬️ Wind Speed:', payload.new.wind_speed, 'm/s');
        console.log('⏰ Timestamp:', payload.new.timestamp);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    )
    .subscribe((status) => {
      console.log(`📡 Subscription status: ${status}`);

      if (status === 'SUBSCRIBED') {
        console.log('✅ REALTIME CONNECTED!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 Listening for INSERT events...');
        console.log('💡 Now run your scraper to insert data:');
        console.log('   cd ../enos_scraper');
        console.log('   source venv/bin/activate');
        console.log('   python singletarget_v2.py');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⏰ Test will run for 5 minutes...');
        console.log('Press Ctrl+C to stop');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel error!');
        console.error('💡 Possible fixes:');
        console.error('   1. Enable Realtime on wind_measurements table');
        console.error('   2. Run fix-realtime.sql in Supabase SQL Editor');
        console.error('   3. Check Supabase Dashboard > Database > Replication');
      } else if (status === 'TIMED_OUT') {
        console.error('❌ Connection timed out!');
        console.error('💡 Possible fixes:');
        console.error('   1. Check your internet connection');
        console.error('   2. Check firewall settings');
        console.error('   3. Try again in a few seconds');
      } else if (status === 'CLOSED') {
        console.log('🔌 Connection closed');
      }
    });

  // Keep alive for 5 minutes
  setTimeout(() => {
    console.log('\n⏰ Test timeout - cleaning up...');
    supabase.removeChannel(channel);
    console.log('✅ Test completed!');
    process.exit(0);
  }, 300000);

  return true;
}

// Run test
testConnection().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  process.exit(0);
});
