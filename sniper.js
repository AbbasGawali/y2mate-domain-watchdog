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

// Elite Tier: Strictly SINGLE-DOT real TLDs only (no .uk.com, no .uk.net)
const ELITE_HOT_TLDS = [
  'shop', 'is', 'skin', 'uno', 'app', 'pro', 'download', 'video', 'tube', 'to',
  'cc', 'fun', 'xyz', 'tv', 'in', 'live', 'stream', 'link', 'cloud', 'media',
  'me', 'site', 'online', 'top', 'rip', 'tools', 'mobi', 'click', 'run',
  'space', 'website', 'icu', 'vip', 'net', 'org', 'info'
];

let allTlds = [];

// Enforce strictly SINGLE-DOT TLDs
function isCleanSingleDotTld(tld) {
  return tld && !tld.includes('.');
}

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
      return list.map(item => item.name.toLowerCase());
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
  const directBuyLink = `https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${encodeURIComponent(domain)}`;
  console.log(`\n⚡ [SUB-SECOND TRIGGER] Sniping WINNER ${domain} (DR: ${drScore}, Price: $${priceUsd.toFixed(2)} / ₹${Math.round(priceUsd * 84)})...`);
  console.log(`🔗 1-Click Buy Link: ${directBuyLink}`);

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
      console.log(`🔒 [SAFETY GUARD] Purchases limit reached (1/1). Sniper permanently locked.`);
      
      await sendAlert({
        success: true,
        domain: domain,
        priceUsd: priceUsd,
        drScore: drScore,
        orderId: result.orderId,
        buyLink: directBuyLink,
        statusMessage: `Successfully bought via GoDaddy API in ${latency}ms!`
      });
      return true;
    } else {
      console.error(`\n[X] Purchase API declined (${res.status}):`, result);
      console.log(`📧 Dispatching urgent email alert with 1-click buy link...`);
      
      await sendAlert({
        success: false,
        domain: domain,
        priceUsd: priceUsd,
        drScore: drScore,
        error: result.message || JSON.stringify(result),
        buyLink: directBuyLink,
        statusMessage: 'Auto-buy declined. Direct 1-click manual buy link attached.'
      });
      return false;
    }
  } catch (err) {
    console.error(`\n[!] Exception during purchase:`, err.message);
    await sendAlert({
      success: false,
      domain: domain,
      priceUsd: priceUsd,
      drScore: drScore,
      error: err.message,
      buyLink: directBuyLink,
      statusMessage: 'Exception during purchase. Direct 1-click buy link attached.'
    });
    return false;
  }
}

async function sendAlert(data) {
  const directLink = data.buyLink || `https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${encodeURIComponent(data.domain)}`;
  const subject = data.success
    ? `🎯 [SNIPED] Successfully Bought ${data.domain} (Ahrefs DR: ${data.drScore}, ₹${Math.round(data.priceUsd * 84)})`
    : `🚨 [DROP DETECTED] ${data.domain} (Ahrefs DR: ${data.drScore}, ₹${Math.round(data.priceUsd * 84)}) - BUY NOW`;

  const payload = {
    _subject: subject,
    Domain: data.domain,
    Ahrefs_DR: data.drScore,
    Price_INR: `₹${Math.round(data.priceUsd * 84)}`,
    Price_USD: `$${data.priceUsd.toFixed(2)}`,
    One_Click_Buy_Link: directLink,
    Status: data.statusMessage || (data.success ? 'Purchased' : 'Action Required'),
    Error_Details: data.error || 'None'
  };

  try {
    const res = await fetch(`https://formsubmit.co/ajax/${ALERT_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://formsubmit.co',
        'Referer': 'https://formsubmit.co/'
      },
      body: JSON.stringify(payload)
    });
    const result = await res.json().catch(() => ({}));
    if (result && (result.success === 'true' || result.success === true)) {
      console.log(`✅ [FormSubmit Email] Successfully delivered alert to ${ALERT_EMAIL}!`);
    } else {
      console.error(`❌ [FormSubmit Email Failed]: ${result.message || 'Unknown response'}`);
      if (result.message && result.message.includes('Activation')) {
        console.error(`🚨 ACTION REQUIRED: Open ${ALERT_EMAIL} inbox/spam and click the "Activate Form" button from FormSubmit!`);
      }
    }
  } catch (e) {
    console.error(`[FormSubmit Email Error]:`, e.message);
  }
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

  // Scan all TLDs in the tier (both single-dot and multi-dot)
  await mapConcurrent(tldList, CONCURRENCY_LIMIT, async (tld) => {
    if (purchaseCount >= MAX_PURCHASES_SESSION) return;
    const domain = `y2mate.${tld}`;
    const isSingleDot = isCleanSingleDotTld(tld);
    const avail = await checkAvailability(domain);

    if (avail && avail.available && avail.definitive) {
      const priceUsd = (avail.price || 0) / 1000000;
      const priceInr = Math.round(priceUsd * 84);

      if (priceInr <= MAX_PRICE_INR && priceUsd <= MAX_PRICE_USD) {
        availableDomains.push({ domain, tld, priceUsd, priceInr, isSingleDot });
      }
    }
  });

  const duration = Date.now() - startTime;

  if (availableDomains.length > 0) {
    console.log(`\n\n====================================================================================================`);
    console.log(`⚡ [${new Date().toLocaleTimeString()}] Discovered ${availableDomains.length} real drop(s) under ₹${MAX_PRICE_INR} in ${duration}ms! Checking Ahrefs DR...`);

    const scored = await Promise.all(
      availableDomains.map(async (item) => {
        const dr = await getAhrefsDR(item.domain);
        return { ...item, dr };
      })
    );

    // Sort descending by DR, then by lowest price
    scored.sort((a, b) => b.dr - a.dr || a.priceInr - b.priceInr);

    // Print clear, beautifully styled ASCII table of ALL found domains
    console.log(`\n📋 [COMPLETE DROPS TABLE - RANKED BY DOMAIN RATING]`);
    console.log(`┌──────┬──────────────────────┬────────────┬───────────┬─────────────┬─────────────┬────────────────────────────────────┐`);
    console.log(`│ RANK │ DOMAIN NAME          │ TLD TYPE   │ AHREFS DR │ PRICE (INR) │ PRICE (USD) │ STATUS                             │`);
    console.log(`├──────┼──────────────────────┼────────────┼───────────┼─────────────┼─────────────┼────────────────────────────────────┤`);
    scored.forEach((item, idx) => {
      const rank = String(idx + 1).padEnd(4, ' ');
      const domain = item.domain.padEnd(20, ' ');
      const type = item.isSingleDot ? 'Single-Dot'.padEnd(10, ' ') : 'Multi-Dot '.padEnd(10, ' ');
      const dr = String(item.dr).padEnd(9, ' ');
      const inr = `₹${item.priceInr}`.padEnd(11, ' ');
      const usd = `${item.priceUsd.toFixed(2)}`.padEnd(11, ' ');

      let status = '';
      if (item.isSingleDot) {
        if (item.dr >= MIN_AHREFS_DR) {
          status = '🔥 QUALIFIED (Auto-Buy & Alert)';
        } else {
          status = `⚪ Low DR (< ${MIN_AHREFS_DR})`;
        }
      } else {
        status = 'ℹ️ Multi-Dot (Logged Only - No Alert)';
      }
      status = status.padEnd(34, ' ');

      console.log(`│ ${rank} │ ${domain} │ ${type} │ ${dr} │ ${inr} │ ${usd} │ ${status} │`);
    });
    console.log(`└──────┴──────────────────────┴────────────┴───────────┴─────────────┴─────────────┴────────────────────────────────────┘\n`);

    // Strictly qualify ONLY single-dot domains meeting DR >= MIN_AHREFS_DR and price <= MAX_PRICE_INR
    const qualified = scored.filter(c => c.isSingleDot && c.dr >= MIN_AHREFS_DR);

    if (qualified.length > 0) {
      const winner = qualified[0];
      console.log(`🎯 SELECTED HIGHEST DR WINNER: ${winner.domain} (DR: ${winner.dr}, ₹${winner.priceInr})`);
      console.log(`====================================================================================================\n`);
      await purchaseDomain(winner.domain, winner.priceUsd, winner.dr);
      return;
    } else {
      console.log(`[-] None of the ${scored.length} drop(s) met the qualification criteria (Single-Dot + DR >= ${MIN_AHREFS_DR} + <= ₹${MAX_PRICE_INR}).`);
      console.log(`====================================================================================================\n`);
    }
  }

  process.stdout.write(`\r[${new Date().toLocaleTimeString()}] ⚡ ${tierName}: ${tldList.length} TLDs checked in ${duration}ms - Clean.`);
}

async function startSniper() {
  const isCI = process.env.GITHUB_ACTIONS === 'true';
  const sessionStartTime = Date.now();
  // In GitHub Actions, runs continuously for 5.5 hours per session
  const MAX_SESSION_MS = isCI ? 330 * 60 * 1000 : Infinity;

  console.log(`====================================================`);
  console.log(`⚡ ULTRA HIGH-SPEED Y2MATE DOMAIN SNIPER ACTIVE`);
  console.log(`🚀 Architecture: 8 Parallel Async Threads`);
  console.log(`🔥 Mode: ${isCI ? 'GitHub Actions Continuous Pipeline' : 'Local 24/7 Daemon'}`);
  console.log(`🛡️ Filter: Strictly Single-Dot TLDs Only`);
  console.log(`⏱️ Hot Loop: 35 Clean Tier 1 TLDs every 3s`);
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
