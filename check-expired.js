const fs = require('fs');
const https = require('https');
const http = require('http');
require('dotenv').config();

const JELLYFIN_URL = process.env.JELLYFIN_URL || 'http://localhost:8096';
const API_TOKEN = process.env.JELLYFIN_API_KEY || '';
const DATA_FILE = process.env.DATA_FILE || './db/data.json';

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'X-Emby-Token': API_TOKEN,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          resolve({ success: false, status: res.statusCode, body: data });
        } else {
          resolve({ success: true, status: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function disableUserInJellyfin(jellyfinId, username) {
  try {
    // First get the user's current policy
    const getResponse = await makeRequest(`${JELLYFIN_URL}/Users/${jellyfinId}`, { method: 'GET' });
    
    if (!getResponse.success) {
      console.log(`  ❌ Failed to get user ${username} (${jellyfinId}): ${getResponse.body}`);
      return false;
    }
    
    let userData;
    try {
      userData = JSON.parse(getResponse.body);
    } catch (e) {
      console.log(`  ❌ Invalid JSON for user ${username}: ${getResponse.body.substring(0, 100)}`);
      return false;
    }
    
    // Update policy to disable user
    const policy = {
      ...userData.Policy,
      IsDisabled: true
    };
    
    const updateResponse = await makeRequest(
      `${JELLYFIN_URL}/Users/${jellyfinId}/Policy`,
      { method: 'POST' },
      JSON.stringify(policy)
    );
    
    if (updateResponse.success) {
      console.log(`  ✅ Disabled ${username} (${jellyfinId})`);
      return true;
    } else {
      console.log(`  ❌ Failed to disable ${username}: ${updateResponse.body.substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Error disabling ${username}: ${error.message}`);
    return false;
  }
}

async function main() {
  const now = new Date();
  console.log(`Current time: ${now.toISOString()}`);
  console.log('='.repeat(60));
  
  // Read data file
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  
  // Find expired clients
  const expiredClients = data.clients.filter(client => {
    if (client.expired) return false; // Already marked expired
    const trialEnd = new Date(client.trialEnd);
    return trialEnd < now;
  });
  
  if (expiredClients.length === 0) {
    console.log('No new expired clients found.');
    return;
  }
  
  console.log(`Found ${expiredClients.length} expired clients:\n`);
  
  let disabledCount = 0;
  let failedCount = 0;
  
  for (const client of expiredClients) {
    const trialEnd = new Date(client.trialEnd);
    console.log(`Processing: ${client.username} (expired: ${trialEnd.toISOString()})`);
    
    const success = await disableUserInJellyfin(client.jellyfinId, client.username);
    
    if (success) {
      client.expired = true;
      disabledCount++;
    } else {
      failedCount++;
    }
  }
  
  // Save updated data
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${disabledCount} disabled, ${failedCount} failed`);
  console.log('Data file updated.');
}

main().catch(console.error);