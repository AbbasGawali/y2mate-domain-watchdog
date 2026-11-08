import fs from 'node:fs';

const GODADDY_TOKEN = process.env.GODADDY_TOKEN || 'gd_pat_mkTG9UGo5YyNUITj2bCJLPsswGYYYnzGdfDGBYyPGyb_08c1b0ac';
const AHREFS_KEY = process.env.AHREFS_KEY || 'yAlv3OBM7h_8pwthcGYdFYbUIQ-TBoQndItVZLo7';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'abbasgawali111@gmail.com';

// ---------------------------------------------------------------------------
// 🛡️ FINANCIAL SAFETY & WALLET GUARDS
// ---------------------------------------------------------------------------
const MAX_PRICE_INR = 500;                     // STRICT: Max ₹500 per domain
const MAX_PRICE_USD = MAX_PRICE_INR / 84;      // ~$5.95 USD
const MIN_AHREFS_DR = 5;                       // Auto-buy if Ahrefs DR >= 5

// HARD WALLET CEILING: Will NEVER buy more than 1 domain in a session
const MAX_PURCHASES_SESSION = 1;
let purchaseCount = 0;

// High-speed concurrency settings
const CONCURRENCY_LIMIT = 8;                   // 8 parallel worker threads
const HOT_TIER_INTERVAL_MS = 3000;             // Check top drops every 3 seconds!

// Default registrant info for GoDaddy automated purchase
const REGISTRANT_DETAILS = {
  nameFirst: 'Abbas',
  nameLast: 'Gawali',
  email: 'abbasgawali111@gmail.com',
  phone: '+91.9876543210',
  addressMailing: {
    address1: 'Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'IN'
  }
};

// Elite Tier: Real top-level extensions where genuine Y2Mate drops and traffic happen
// (Excludes CentralNic vanity subdomains like uk.com/uk.net that inherit fake DR)
const ELITE_HOT_TLDS = [
  'shop', 'is', 'skin', 'uno', 'app', 'pro', 'download', 'video', 'tube', 'to',
  'cc', 'fun', 'xyz', 'tv', 'in', 'live', 'stream', 'link', 'cloud', 'media',
  'me', 'site', 'online', 'top', 'rip', 'tools', 'co.in', 'org.in', 'mobi',
  'click', 'run', 'space', 'website', 'icu', 'vip', 'net', 'org', 'info'
];

// CentralNic / third-party vanity SLDs to exclude (they inherit fake root DR)
const BANNED_SLDS = ['uk.com', 'uk.net', 'us.com', 'eu.com', 'cn.com', 'de.com', 'ru.com', 'sa.com', 'za.com', 'gr.com'];

let allTlds = [];

async function fetchAllGoDaddyTlds() {
  try {
    const res = await fetch('https://api.godaddy.com/v1/domains/tlds', {
      headers: {
        'Authorization': `Bearer ${GODADDY_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    if (res.ok) {
      const list = await res.json();
      return list
        .map(item => item.name.toLowerCase())
        .filter(tld => !BANNED_SLDS.includes(tld));
    }
  } catch (e) {}

  return ELITE_HOT_TLDS;
}

async function checkAvailability(domain) {
  try {
    const res = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: {
        'Authorization': `Bearer ${GODADDY_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

async function getAhrefsDR(domain) {
  try {
    const res = await fetch(`https://api.ahrefs.com/v3/public/domain-rating-free?target=${encodeURIComponent(domain)}`, {
      headers: {
        'Authorization': `Bearer ${AHREFS_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) return 0;
    const data = await res.json();
    return data?.domain_rating?.domain_rating || 0;
  } catch (err) {
    return 0;
  }
}

async function purchaseDomain(domain, priceUsd, drScore) {
  if (purchaseCount >= MAX_PURCHASES_SESSION) {
    console.warn(`\n🛑 [SAFETY LOCK TRIGGERED] Max purchases reached (${MAX_PURCHASES_SESSION}). Aborting.`);
    return false;
  }

  const startTime = Date.now();
  console.log(`\n⚡ [SUB-SECOND TRIGGER] Sniping WINNER ${domain} (DR: ${drScore}, Price: $${priceUsd.toFixed(2)} / ₹${Math.round(priceUsd * 84)})...`);

  const purchaseBody = {
    domain: domain,
    consent: {
      agreementKeys: ['DNRA'],
      agreedBy: `${REGISTRANT_DETAILS.nameFirst} ${REGISTRANT_DETAILS.nameLast}`,
      agreedAt: new Date().toISOString()
    },
    period: 1,
    contactRegistrant: REGISTRANT_DETAILS,
    contactAdmin: REGISTRANT_DETAILS,
    contactBilling: REGISTRANT_DETAILS,
    contactTech: REGISTRANT_DETAILS
  };

  try {
    const res = await fetch('https://api.godaddy.com/v1/domains/purchase', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GODADDY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(purchaseBody)
    });

    const latency = Date.now() - startTime;
    const rawText = await res.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      result = { raw: rawText };
    }

    if (res.ok && (result.orderId || result.total)) {
      purchaseCount++;
      console.log(`\n🎉 [SNIPED IN ${latency}ms] Domain ${domain} REGISTERED! Order ID: ${result.orderId}`);
      console.log(`🔒 [SAFETY GUARD] Purchases limit reached (1/1). Sniper permanently locked to protect card.`);
      
      await sendAlert({
        success: true,
        domain: domain,
        priceUsd: priceUsd,
        drScore: drScore,
        orderId: result.orderId,
        details: `Drop beaten and registered in ${latency}ms!`
      });
      return true;
    } else {
      console.error(`\n[X] Purchase API returned (${res.status}):`, result);
      await sendAlert({
        success: false,
        domain: domain,
        priceUsd: priceUsd,
        drScore: drScore,
        error: result.message || JSON.stringify(result),
        directBuyUrl: `https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${encodeURIComponent(domain)}`
      });
      return false;
    }
  } catch (err) {
    console.error(`\n[!] Exception during purchase:`, err.message);
    return false;
  }
}

async function sendAlert(data) {
  const subject = data.success
    ? `🎯 [SNIPED] Bought ${data.domain} (Ahrefs DR: ${data.drScore}, ₹${Math.round(data.priceUsd * 84)})!`
    : `⚠️ [ACTION REQUIRED] ${data.domain} Dropped (Ahrefs DR: ${data.drScore}) - Buy Manually Now!`;

  try {
    await fetch(`https://formsubmit.co/ajax/${ALERT_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://y2mate.cyou',
        'Referer': 'https://y2mate.cyou/'
      },
      body: JSON.stringify({
        _subject: subject,
        ...data
      })
    });
  } catch (e) {}
}

async function mapConcurrent(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

async function evaluateTlds(tldList, tierName) {
  if (purchaseCount >= MAX_PURCHASES_SESSION) return;

  const startTime = Date.now();
  const availableDomains = [];

  await mapConcurrent(tldList, CONCURRENCY_LIMIT, async (tld) => {
    if (purchaseCount >= MAX_PURCHASES_SESSION) return;
    const domain = `y2mate.${tld}`;
    const avail = await checkAvailability(domain);

    if (avail && avail.available) {
      const priceUsd = (avail.price || 0) / 1000000;
      const priceInr = Math.round(priceUsd * 84);

      if (priceInr <= MAX_PRICE_INR && priceUsd <= MAX_PRICE_USD) {
        availableDomains.push({ domain, priceUsd, priceInr });
      }
    }
  });

  const duration = Date.now() - startTime;

  if (availableDomains.length > 0) {
    console.log(`\n⚡ [${new Date().toLocaleTimeString()}] Found ${availableDomains.length} drop(s) under ₹500 in ${duration}ms! Checking Ahrefs DR in parallel...`);

    const scored = await Promise.all(
      availableDomains.map(async (item) => {
        const dr = await getAhrefsDR(item.domain);
        return { ...item, dr };
      })
    );

    const qualified = scored.filter(c => c.dr >= MIN_AHREFS_DR);

    if (qualified.length > 0) {
      qualified.sort((a, b) => b.dr - a.dr);

      console.log(`\n🏆 [LEADERBOARD] Qualified drops:`);
      qualified.forEach((q, idx) => {
        console.log(`   #${idx + 1}: ${q.domain} (DR: ${q.dr}, ₹${q.priceInr})`);
      });

      const winner = qualified[0];
      await purchaseDomain(winner.domain, winner.priceUsd, winner.dr);
      return;
    }
  }

  process.stdout.write(`\r[${new Date().toLocaleTimeString()}] ⚡ ${tierName}: ${tldList.length} TLDs checked in ${duration}ms - Clean.`);
}

async function startSniper() {
  const isCI = process.env.GITHUB_ACTIONS === 'true';
  const sessionStartTime = Date.now();
  const MAX_SESSION_MS = isCI ? 13.5 * 60 * 1000 : Infinity;

  console.log(`====================================================`);
  console.log(`⚡ ULTRA HIGH-SPEED Y2MATE DOMAIN SNIPER ACTIVE`);
  console.log(`🚀 Architecture: 8 Parallel Async Threads`);
  console.log(`🔥 Mode: ${isCI ? 'GitHub Actions Continuous Pipeline' : 'Local 24/7 Daemon'}`);
  console.log(`⏱️ Hot Loop: 35 Tier 1 TLDs every 3s`);
  console.log(`💰 Max Price: ₹${MAX_PRICE_INR} | Min DR: ${MIN_AHREFS_DR}+`);
  console.log(`🔒 Safety: 1 Purchase Limit`);
  console.log(`====================================================\n`);

  allTlds = await fetchAllGoDaddyTlds();
  const secondaryTlds = allTlds.filter(t => !ELITE_HOT_TLDS.includes(t));

  await evaluateTlds(ELITE_HOT_TLDS, 'Tier 1 (Hot)');

  while (purchaseCount < MAX_PURCHASES_SESSION && (Date.now() - sessionStartTime < MAX_SESSION_MS)) {
    await new Promise(r => setTimeout(r, HOT_TIER_INTERVAL_MS));
    await evaluateTlds(ELITE_HOT_TLDS, 'Tier 1 (Hot)');

    if (Math.floor((Date.now() - sessionStartTime) / 1000) % 60 < 4 && secondaryTlds.length > 0) {
      await evaluateTlds(secondaryTlds, 'Tier 2 (Full Catalog)');
    }
  }

  console.log(`\n✅ Session cycle complete. Exiting cleanly.`);
}

startSniper();
