const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Try multiple connection strings
const configs = [
  {
    name: "Session Pooler (5432)",
    connectionString: `postgresql://postgres.ulpqwuaweuutydxlcbau:hejtez-qiqnEh-huzzo7@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
    ssl: { rejectUnauthorized: false }
  },
  {
    name: "Transaction Pooler (6543)", 
    connectionString: `postgresql://postgres.ulpqwuaweuutydxlcbau:hejtez-qiqnEh-huzzo7@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
  }
];

const sql = fs.readFileSync(path.join(__dirname, '../supabase/schema.sql'), 'utf8');

async function tryConnect(config) {
  const client = new Client({
    connectionString: config.connectionString,
    ssl: config.ssl,
    connectionTimeoutMillis: 8000,
  });
  
  console.log(`\nTrying: ${config.name}...`);
  try {
    await client.connect();
    console.log('✅ Connected!');
    await client.query(sql);
    console.log('✅ Schema created successfully!');
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ Failed: ${err.message}`);
    try { await client.end(); } catch {}
    return false;
  }
}

(async () => {
  for (const config of configs) {
    const ok = await tryConnect(config);
    if (ok) process.exit(0);
  }
  console.log('\n❌ All connections failed. Will show connection info...');
  process.exit(1);
})();
