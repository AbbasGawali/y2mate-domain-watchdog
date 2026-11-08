import fs from 'node:fs';

const GODADDY_TOKEN = process.env.GODADDY_TOKEN || 'gd_pat_mkTG9UGo5YyNUITj2bCJLPsswGYYYnzGdfDGBYyPGyb_08c1b0ac';
const AHREFS_KEY = process.env.AHREFS_KEY || 'yAlv3OBM7h_8pwthcGYdFYbUIQ-TBoQndItVZLo7';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'abbasgawali111@gmail.com';

// Budget limits
const MAX_PRICE_INR = 600;                     // ₹600 max purchase price
const MAX_PRICE_USD = MAX_PRICE_INR / 84;      // ~$7.14 USD
const MIN_AHREFS_DR = 5;                       // Auto-buy if Ahrefs DR >= 5

// High-value clean TLDs to monitor continuously
const TARGET_TLDS = [
  'shop',      // High-priority (just had DR 18)
  'is',        // Historic Y2Mate mirror (Icelandic)
  'skin',      // Proven high-earning mirror
  'uno',       // Proven 500k+ historical traffic
  'app',       // Official app mirror
  'pro',       // Premium authority brand
  'download',  // Exact intent keyword
  'video',     // Exact intent keyword
  'tube',      // YouTube exact association
  'to',        // Offshore bulletproof standard
  'cc',        // Classic short clean brand
  'fun',       // High CTR viral mirror
  'stream',    // Direct media keyword
  'live',      // Real-time conversion brand
  'link',      // Direct shareable brand
  'site',      // Classic mirror staple
  'online',    // High search volume mirror
  'top',       // Top tier cheap mirror
  'icu',       // Low cost bulk mirror
  'vip',       // High CTR VIP promo
  'xyz',       // Modern universal standard
  'me',        // Personal tool branding
  'cloud',     // Fast cloud extraction association
  'tv',        // Video industry staple
  'media',     // Broad content authority
  'rip',       // YouTube ripper staple
  'mobi',      // Mobile device direct brand
  'click',     // High CTR converter
  'run',       // Fast action keyword
  'space',     // Lightweight popular mirror
  'website',   // High-trust generic
  'tools',     // Utility niche standard
  'org.in',    // Indian exact match
  'co.in',     // Indian commercial
  'in'         // India ccTLD
];

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

async function checkAvailability(domain) {
  try {
    const res = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: {
        'Authorization': `Bearer ${GODADDY_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (res.status === 429) {
      console.warn(`[!] GoDaddy rate limit hit on ${domain}. Pausing 2s...`);
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
    console.error(`Ahrefs error for ${domain}:`, err.message);
    return 0;
  }
}

async function purchaseDomain(domain, priceUsd, drScore) {
  console.log(`\n🚨 [SNIPER TRIGGERED] Executing instant purchase for ${domain} (Price: $${priceUsd}, Ahrefs DR: ${drScore})...`);

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
      console.log(`🎉 [SUCCESS] Domain ${domain} SNIPED and registered! Order ID: ${result.orderId}`);
      await sendAlert({
        success: true,
        domain: domain,
        priceUsd: priceUsd,
        drScore: drScore,
        orderId: result.orderId,
        details: 'Domain bought automatically via GoDaddy API!'
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
  const timestamp = new Date().toLocaleTimeString();
  process.stdout.write(`[${timestamp}] Checking ${TARGET_TLDS.length} TLDs... `);

  for (const tld of TARGET_TLDS) {
    const domain = `y2mate.${tld}`;
    const avail = await checkAvailability(domain);

    if (avail && avail.available) {
      const priceUsd = (avail.price || 0) / 1000000;
      const priceInr = Math.round(priceUsd * 84);

      console.log(`\n\n🔍 DETECTED AVAILABLE: ${domain} | Price: ₹${priceInr} ($${priceUsd.toFixed(2)})`);

      // 1. Price check filter
      if (priceUsd <= MAX_PRICE_USD) {
        // 2. Instant Ahrefs DR check
        console.log(`[+] Querying Ahrefs DR for ${domain}...`);
        const dr = await getAhrefsDR(domain);
        console.log(`[+] Ahrefs DR Score for ${domain}: ${dr}`);

        if (dr >= MIN_AHREFS_DR) {
          console.log(`⚡ [CRITICAL HIT] ${domain} has DR ${dr} >= ${MIN_AHREFS_DR}! Triggering instant auto-buy!`);
          await purchaseDomain(domain, priceUsd, dr);
        } else {
          console.log(`[-] ${domain} DR (${dr}) is below threshold (${MIN_AHREFS_DR}). Skipped purchase.`);
        }
      } else {
        console.log(`[-] ${domain} Price (₹${priceInr}) exceeds budget limit (₹${MAX_PRICE_INR}). Skipped.`);
      }
    }

    await new Promise(r => setTimeout(r, 250));
  }

  process.stdout.write(`Done.\n`);
}

async function startSniper() {
  console.log(`====================================================`);
  console.log(`🚀 Y2MATE INSTANT DOMAIN SNIPER BOT ACTIVE`);
  console.log(`🎯 Target: exact y2mate.<tld> across ${TARGET_TLDS.length} high-value extensions`);
  console.log(`💰 Max Purchase Price: ₹${MAX_PRICE_INR} (~$${MAX_PRICE_USD.toFixed(2)} USD)`);
  console.log(`📈 Min Ahrefs Domain Rating: ${MIN_AHREFS_DR}+`);
  console.log(`====================================================\n`);

  // Run initial scan
  await scanOnce();

  // If running in continuous mode (local or server daemon), loop every 20 seconds
  if (process.argv.includes('--loop') || process.env.SNIPER_CONTINUOUS === 'true') {
    console.log(`[*] Continuous sniper loop engaged (checking every 20s)...`);
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
