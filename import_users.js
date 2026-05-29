const fs = require('fs');

// Load data
const data = JSON.parse(fs.readFileSync('./db/data.json', 'utf8'));

// Rudi's reseller ID
const resellerId = 2;

// Expiry date: 2 months from now
const expiryDate = new Date();
expiryDate.setMonth(expiryDate.getMonth() + 2);
const trialEnd = expiryDate.toISOString();

// Jellyfin users (from the list)
const jellyfinUsers = [
  {id: "272b61309cf64ca6ac9d1d624d9c4225", name: "@AlmaStassen@"},
  {id: "7a66f8c0b8f140fdaaf52cd1af64b09c", name: "@Colette@"},
  {id: "0e53dd16c97d4096b69678c0ddf0d04e", name: "gerry"},
  {id: "970765fc464e4411a11027c72db4e1c5", name: "Hannes"},
  {id: "80a9a18f43cb46089011594739b4a903", name: "KarenBarnard"},
  {id: "f356f9dd8a9d4543a3bcee636da8d38b", name: "KarinLiebe"},
  {id: "6888225db36846afb3212c3e19169967", name: "Lisma"},
  {id: "aaeec60979544f059447c6ed29ca62db", name: "LouiseKruger"},
  {id: "b4a3d2ca11374d248a23a4b021bffe6b", name: "Magda"},
  {id: "de7eb131d3b540959e1e8a2679541489", name: "Magdel"},
  {id: "4ca9f0468b5d4fd480eada973dad6baf", name: "Marinda"},
  {id: "e3f24a20be3f4593a0fc498ec67312cf", name: "Nicci"},
  {id: "f7b8e313e7764cd49111648191165020", name: "Nick"},
  {id: "ad7217788263431287743cfc26dec181", name: "Pieter"},
  {id: "360468fe4cff4c289743738d90393ae7", name: "Renè"},
  {id: "e2c3a586708440ca826be9131d61a011", name: "Wayde"},
  {id: "98b67aa589764176b39a4441884025e0", name: "@WilnaNiemann@"},
  {id: "d38e6d436bb04df697f7053a300c946f", name: "001DanieM"},
  {id: "fd0e6095f1b64d07a8649bf37cd04449", name: "001DollieR2"},
  {id: "9eb25ccf06004c6abfcd951e4c4280a9", name: "001JoeyKruger"},
  {id: "947214a0a57f4a2184546065e6d11778", name: "001Jolanda"},
  {id: "f6ceb84e06be4baeadc252ebaf9d4009", name: "001LizellDrots"},
  {id: "12aba8a80dd64025b8293b9bdb495ace", name: "001Lizette"},
  {id: "45ef25891b56402793e43a1d228ecbae", name: "001louiseMuller"},
  {id: "27b62dbebe24485ca5f1e6d841901430", name: "001Magriet"},
  {id: "928f8a2b6b7744ecb4753fb484869502", name: "001merril"},
  {id: "f30d9753533d46be8790b11186075a67", name: "001SonjaFish"},
  {id: "91329566eeeb4150aeaed750c336409a", name: "001Sonjavanrheede"},
  {id: "32065ce898a24774bfda616cd814c912", name: "001Victor"},
  {id: "26de953229b4499fbba67a89962a4ea5", name: "002Albert"},
  {id: "8a5f8a4e2b6541248ce54230d458241a", name: "002Santjie"},
  {id: "875765cb7b6440a98ca27a73095ac14b", name: "005Madelein"},
  {id: "f0614bc5e3e64a1783eb9470f2ed2b1c", name: "005Nicoleen2"},
  {id: "1b6a265782fe40db80564651f4fc0b71", name: "005Verushka"},
  {id: "bedb86a08abb45e7850ce58c487d0b94", name: "1Chantelle"},
  {id: "cbf477584c1546d8a2ec6360ba60414d", name: "1jelly0035"},
  {id: "5bb9f18425c6461c9be46bd7df1c78d8", name: "AndreG"},
  {id: "e46486fbc7a344fc9ecdf10c6acb6c53", name: "Anneke123"},
  {id: "ef37a8e2d0cf4f0cb507bf401726dbe8", name: "Armand"},
  {id: "a30452b255af4cad957bd39ec79ab008", name: "Barry007"},
  {id: "aeed9a20568b4847927e08f3117a3e37", name: "CarolineRoss"},
  {id: "c54f42927b3a465abd432f9446363b01", name: "Charesna"},
  {id: "cdb2f2f930744d50b587757e429a4ec4", name: "CharlesP"},
  {id: "0e4ed5e76b6c42818f5ff36f377a78e1", name: "choppies"},
  {id: "05597a8da0114ad681ec8350867de90f", name: "Chris@"},
  {id: "9b49c93796cb4df59baf28596da2e8a7", name: "chris772"},
  {id: "03f8068d12164bb08d392a42a9150463", name: "Christha"},
  {id: "2491a7268c5e4be5b4362a898ecc1dee", name: "clawaneesa"},
  {id: "4009d77d0a484005846851d1321a7adb", name: "clawBertie"},
  {id: "710548eb4ddb4c02998cbe7b98a9c9b4", name: "clawIllseNel"},
  {id: "1b428cb9c8c545168b5ded1792530719", name: "clawVeronicaLewis"},
  {id: "d0042527bbdb419ba5944992a777f8ab", name: "clawYolande"},
  {id: "2a437c3116f946c2bdf84d7916729c6e", name: "ColetteEls001"},
  {id: "1afaebdeddc3440b9b05e0ea4cf4cfda", name: "CorneSpangenberg"},
  {id: "ee1f25b5a60c4f518bfdd6ee444076e7", name: "Dawn777"},
  {id: "d8b43aec066d47c59bff88cc78524934", name: "Elna"},
  {id: "9c9116e289294ce1b1f78f67d7c718b4", name: "Estelle"},
  {id: "28cd5930f2384b2ca1e5af268d13ca57", name: "Evette"},
  {id: "db5c691f23564bd7a6f065ce2168b2b8", name: "Freddy"},
  {id: "a502ab4ed2014c4b838427b904d4b822", name: "Hannesf00"},
  {id: "1134eca733f3446a9ebfc57d1db12a0d", name: "Helena"},
  {id: "8825a16b40934f749ff4e4fb4fafea3b", name: "HelenanelAustralie001"},
  {id: "574490c1cf9f4a8d9c05bf95726ec2b6", name: "Jolanda"},
  {id: "d3297ca854244443a20a53ff20ed17fb", name: "Jolandakids"},
  {id: "713707280b1f4aad874d897ec6286101", name: "joutv158"},
  {id: "15af8935277942999edbddb81332d13a", name: "joutv41"},
  {id: "2b08920b0a1541678677ebc55efa96c5", name: "Juan2Dubruyn"},
  {id: "3d7b3151202149bcbf9185d97b0b2d40", name: "KarienBrienen"},
  {id: "5d02500349054baba857bda98070ebe6", name: "LanellJansen"},
  {id: "9e008a13d8324df0b5fd702a62c1659f", name: "LianaDumond2"},
  {id: "e370051c1448432aa57915e8b992965e", name: "Liezl"},
  {id: "1ffd2ac594ed419d83c57c1dfc47238a", name: "lin00079"},
  {id: "0beed038ecac4f059af1ab1264d848e8", name: "lindi"},
  {id: "f61e3d4fb67c49448473730abadc2cda", name: "LouieDuRaan"},
  {id: "4d4717de0510414fa3203fba169d95cf", name: "LouiseKruger"},
  {id: "5cac95451d3f4682a1eb1ac03f581a9e", name: "Lynette3"},
  {id: "2e365d94736042b7a6eabb0ae8e2c4f1", name: "lynfliek21"},
  {id: "49c6ef0d192b44fabc7f190d1f0678a3", name: "LynfliekPA"},
  {id: "605a79b073614d3baa61f84c3c5be9cb", name: "Magdel"},
  {id: "40988bb45daa463482348dbf49ec8848", name: "MandineCarstens"},
  {id: "9279bf1af4ad4bca8ef036f6a29ed10e", name: "MarietjieMuller"},
  {id: "71ab61c187404bd998dbfec7e9fde0ac", name: "marilynbehr"},
  {id: "5145f222cedc4955a0d98fde0a6c141d", name: "MarinaOosthuizen"},
  {id: "5d29b2985ebe41b7ab64bc1c59dc69cb", name: "Mariska"},
  {id: "1cc4b68007a84409954fcf1ac3e1f7a8", name: "Maritsa"},
  {id: "fd5e8995963645778486925218d65856", name: "MarynaSaaiman"},
  {id: "88094211e5764cbab8a5e43db2c6852c", name: "michat"},
  {id: "48c810ec7b364887859c0667ae59f50e", name: "MonikaJordaan"},
  {id: "39a681446d84472cb45056786a4f90ee", name: "papa"},
  {id: "95d06510c82844ca96ff1706a9d828b3", name: "pietv15ARB"},
  {id: "85061a76a8324c53b50b77c8725936b7", name: "r11454555"},
  {id: "d1fce9645a964f0d8dffe96e48d87c25", name: "Rafiki"},
  {id: "352ba2246d1f4baea7979df03cf35de4", name: "SanellWessels"},
  {id: "d819c9cd30454161b61902c67a363264", name: "SarinaDicks"},
  {id: "826bc2c63d07430893d2e526f9972059", name: "SharneLansdown"},
  {id: "b8281a47e99f419b8bd9136af6cf8a4c", name: "tiennie12"},
  {id: "61420977", name: "W61420977"},
  {id: "9a624a8e66934cd7bfdf9d91c1b3edab", name: "w8176WE2PPU1"},
  {id: "f3da61d72013470e96e87609e155d764", name: "Wener"},
  {id: "8631252c82134be9a61bd8f783674ae5", name: "zcVm9mVX"}
];

// Get existing client usernames
const existingUsernames = new Set(data.clients.map(c => c.username.toLowerCase()));

// Get next ID
let nextId = data.clients.length > 0 ? Math.max(...data.clients.map(c => c.id)) + 1 : 1;

// Add users
let addedCount = 0;
for (const user of jellyfinUsers) {
  // Skip if already exists or if it's "rudi"
  if (existingUsernames.has(user.name.toLowerCase()) || user.name.toLowerCase() === 'rudi') {
    continue;
  }
  
  // Add client
  data.clients.push({
    id: nextId++,
    jellyfinId: user.id,
    username: user.name,
    password: '(imported - no password)',
    resellerId: resellerId,
    trialStart: new Date().toISOString(),
    trialEnd: trialEnd,
    isPaid: true,
    createdAt: new Date().toISOString()
  });
  
  addedCount++;
}

// Save
fs.writeFileSync('./db/data.json', JSON.stringify(data, null, 2));

console.log(`✅ Imported ${addedCount} users under Rudi`);
console.log(`📅 Expiry date: ${expiryDate.toISOString().split('T')[0]}`);
console.log(`👥 Total clients: ${data.clients.length}`);
