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

// HARD WALLET CEILING: Will NEVER buy more than this number of domains in a session
// Even if 10 domains drop simultaneously, it will buy only 1 and immediately freeze!
const MAX_PURCHASES_SESSION = 1;
let purchaseCount = 0;

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

let cachedTlds = [];

// Fetches ALL 500+ official TLDs directly from GoDaddy API dynamically
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
      const tlds = list.map(item => item.name.toLowerCase());
      console.log(`[+] Loaded ${tlds.length} official GoDaddy TLDs dynamically.`);
      return tlds;
    }
  } catch (e) {
    console.warn('[!] Failed to fetch dynamic TLD list, using fallback array:', e.message);
  }

  return [
    'shop', 'is', 'skin', 'uno', 'app', 'pro', 'download', 'video', 'tube', 'to',
    'cc', 'fun', 'stream', 'live', 'link', 'site', 'online', 'top', 'icu', 'vip',
    'xyz', 'me', 'cloud', 'tv', 'media', 'rip', 'mobi', 'click', 'run', 'space',
    'website', 'tools', 'org.in', 'co.in', 'in', 'tech', 'digital', 'center'
  ];
}

async function checkAvailability(domain) {
  try {
    const res = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: {
        'Authorization': `Bearer ${GODADDY_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      return null;
    }

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
    console.warn(`\n🛑 [SAFETY LOCK TRIGGERED] Reached maximum allowed purchases (${MAX_PURCHASES_SESSION}). Aborting.`);
    return false;
  }

  console.log(`\n🚨 [SNIPER TRIGGERED] Executing instant purchase for HIGHEST DR winner: ${domain} (DR: ${drScore}, Price: $${priceUsd.toFixed(2)} / ₹${Math.round(priceUsd * 84)})...`);

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

    const result = await res.json();
    console.log('[GoDaddy Purchase Response]:', result);

    if (res.ok && (result.orderId || result.total)) {
      purchaseCount++;
      console.log(`🎉 [SUCCESS] Winner ${domain} (DR ${drScore}) SNIPED! Order ID: ${result.orderId}`);
      console.log(`🔒 [SAFETY GUARD] Total purchases in session: ${purchaseCount}/${MAX_PURCHASES_SESSION}. Sniper locked.`);
      
      await sendAlert({
        success: true,
        domain: domain,
        priceUsd: priceUsd,
        drScore: drScore,
        orderId: result.orderId,
        details: 'Highest DR domain bought automatically via GoDaddy API!'
      });
      return true;
    } else {
      console.error(`[X] Auto-purchase failed for ${domain}:`, result);
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
    console.error(`[!] Exception during purchase of ${domain}:`, err.message);
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

async function scanOnce() {
  if (purchaseCount >= MAX_PURCHASES_SESSION) {
    console.log(`[Safety Lock] Purchase limit reached (${purchaseCount}/${MAX_PURCHASES_SESSION}). Standing down.`);
    return;
  }

  if (cachedTlds.length === 0) {
    cachedTlds = await fetchAllGoDaddyTlds();
  }

  const highPriority = ['shop', 'is', 'skin', 'uno', 'app', 'pro', 'download', 'video', 'tube', 'to', 'cc', 'fun', 'xyz', 'tv', 'in'];
  const otherTlds = cachedTlds.filter(t => !highPriority.includes(t));
  const fullScanList = [...highPriority, ...otherTlds];

  const timestamp = new Date().toLocaleTimeString();
  process.stdout.write(`[${timestamp}] Checking TLDs for y2mate... `);

  // Collect all eligible candidates in this cycle
  const eligibleCandidates = [];

  for (const tld of fullScanList) {
    const domain = `y2mate.${tld}`;
    const avail = await checkAvailability(domain);

    if (avail && avail.available) {
      const priceUsd = (avail.price || 0) / 1000000;
      const priceInr = Math.round(priceUsd * 84);

      // Check price ceiling (<= ₹500)
      if (priceInr <= MAX_PRICE_INR && priceUsd <= MAX_PRICE_USD) {
        console.log(`\n\n🔍 DETECTED UNDER ₹500: ${domain} (₹${priceInr}) | Checking Ahrefs DR...`);
        const dr = await getAhrefsDR(domain);
        console.log(`[+] ${domain} -> Ahrefs DR: ${dr}`);

        if (dr >= MIN_AHREFS_DR) {
          eligibleCandidates.push({
            domain,
            priceUsd,
            priceInr,
            dr
          });
        }
      }
    }

    await new Promise(r => setTimeout(r, 180));
  }

  process.stdout.write(`Done.\n`);

  // If multiple domains qualified, sort descending by DR to pick the absolute highest value!
  if (eligibleCandidates.length > 0) {
    eligibleCandidates.sort((a, b) => b.dr - a.dr);

    console.log(`\n====================================================`);
    console.log(`🏆 [CANDIDATE RANKING] Found ${eligibleCandidates.length} eligible drop(s):`);
    eligibleCandidates.forEach((c, idx) => {
      console.log(`   #${idx + 1}: ${c.domain} | Ahrefs DR: ${c.dr} | Price: ₹${c.priceInr}`);
    });

    const winner = eligibleCandidates[0];
    console.log(`🎯 SELECTED HIGHEST DR WINNER: ${winner.domain} (DR: ${winner.dr})`);
    console.log(`====================================================\n`);

    await purchaseDomain(winner.domain, winner.priceUsd, winner.dr);
  }
}

async function startSniper() {
  console.log(`====================================================`);
  console.log(`🚀 Y2MATE INSTANT ALL-TLD SNIPER ACTIVE`);
  console.log(`🎯 Target: ANY official TLD for y2mate.*`);
  console.log(`💰 Strict Max Price: ₹${MAX_PRICE_INR} (~$${MAX_PRICE_USD.toFixed(2)} USD)`);
  console.log(`📈 Min Ahrefs Domain Rating: ${MIN_AHREFS_DR}+ (Ranks and buys highest DR winner)`);
  console.log(`🔒 Hard Safety Lock: Max ${MAX_PURCHASES_SESSION} purchase per session (card protection)`);
  console.log(`====================================================\n`);

  cachedTlds = await fetchAllGoDaddyTlds();
  await scanOnce();

  if (process.argv.includes('--loop') || process.env.SNIPER_CONTINUOUS === 'true') {
    console.log(`[*] Continuous sniper loop engaged...`);
    setInterval(async () => {
      try {
        await scanOnce();
      } catch (err) {
        console.error('[!] Loop error:', err.message);
      }
    }, 20000);
  }
}

startSniper();
