import fs from 'node:fs';

const GODADDY_TOKEN = process.env.GODADDY_TOKEN || 'gd_pat_mkTG9UGo5YyNUITj2bCJLPsswGYYYnzGdfDGBYyPGyb_08c1b0ac';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'abbasgawali111@gmail.com';

// Price thresholds: affordable initial buy + sustainable renewal
const MAX_FIRST_YEAR_PRICE_USD = 15; // Under ~$15 (₹1,250)
const MAX_RENEWAL_PRICE_USD = 30;    // Under ~$30 (₹2,500)

// ONLY Elite, High-Performing TLDs that are proven in the downloader niche.
// We monitor these currently-taken high-value domains so the split second
// an existing owner fails to renew and it drops, you get the urgent alert to grab it!
const ELITE_HIGH_VALUE_TLDS = [
  'uno',       // Proven 500k+ historical traffic (paneer just saw taken)
  'skin',      // Classic high-earning mirror (previously lost)
  'download',  // Exact intent keyword
  'stream',    // Direct media keyword
  'app',       // Official app landing mirror
  'pro',       // Premium authority brand
  'tools',     // Utility niche standard
  'live',      // Instant real-time conversion brand
  'link',      // Direct shareable brand
  'tv',        // Video industry staple
  'online',    // High search volume mirror
  'site',      // Classic mirror staple
  'fun',       // Viral traffic mirror
  'space',     // Lightweight popular mirror
  'website',   // High-trust generic
  'media',     // Broad content authority
  'video',     // Exact intent keyword
  'tube',      // YouTube exact association
  'run',       // Fast action keyword
  'click',     // High CTR converter
  'top',       // Top tier cheap mirror
  'icu',       // Low cost bulk mirror
  'vip',       // High CTR VIP promo
  'to',        // Offshore bulletproof standard
  'cc',        // Classic short clean brand
  'me',        // Personal tool branding
  'cloud',     // Fast cloud extraction association
  'mobi',      // Mobile device direct brand
  'xyz',       // Modern universal standard
  'info',      // High SEO citation volume
  'is',        // Historic Y2Mate mirror (Icelandic)
  'nu',        // Classic video downloader mirror
  'sh',        // Developer / media converter standard
  'rip',       // YouTube ripper staple
  'lol',       // High CTR short mirror
  'life'       // Consumer utility brand
];

async function checkDomain(domain) {
  try {
    const res = await fetch(`https://api.godaddy.com/v1/domains/available?domain=${encodeURIComponent(domain)}`, {
      headers: {
        'Authorization': `Bearer ${GODADDY_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (res.status === 429) {
      console.warn(`[!] Rate limited on ${domain}. Sleeping 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      return null;
    }

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`Error checking ${domain}:`, err.message);
    return null;
  }
}

async function sendEmailAlert(domain, priceUsd, renewalUsd, buyUrl) {
  console.log(`\n🚨 [ALERT] HIGH VALUE DOMAIN DROPPED: ${domain} (Price: $${priceUsd}) 🚨`);
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${ALERT_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://y2mate.cyou',
        'Referer': 'https://y2mate.cyou/'
      },
      body: JSON.stringify({
        _subject: `🚨 URGENT: HIGH VALUE ${domain} DROPPED & AVAILABLE TO BUY (₹${Math.round(priceUsd * 84)})!`,
        domain: domain,
        first_year_price: `$${priceUsd} (~₹${Math.round(priceUsd * 84)})`,
        renewal_price: `$${renewalUsd} (~₹${Math.round(renewalUsd * 84)})`,
        buy_direct_link: buyUrl,
        instructions: `An existing owner dropped this premium domain. Grab it immediately before bots front-run it: ${buyUrl}`
      })
    });
    const data = await res.json();
    console.log('[✓] Alert email sent result:', data);
  } catch (err) {
    console.error('[!] Failed to send email alert:', err.message);
  }
}

async function runScan() {
  console.log(`[${new Date().toISOString()}] Scanning ${ELITE_HIGH_VALUE_TLDS.length} ELITE high-performing TLDs for y2mate...`);
  const foundAvailable = [];

  for (const tld of ELITE_HIGH_VALUE_TLDS) {
    const domain = `y2mate.${tld}`;
    const result = await checkDomain(domain);

    if (result && result.available) {
      const priceUsd = (result.price || 0) / 1000000;
      const renewalUsd = (result.renewalPrice || 0) / 1000000;
      const buyUrl = `https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${encodeURIComponent(domain)}`;

      console.log(`\n[★] DROPPED & AVAILABLE: ${domain} | Price: $${priceUsd} | Renewal: $${renewalUsd}`);

      // Filter: only real retail prices, protect against crazy premium price spikes
      if (priceUsd <= MAX_FIRST_YEAR_PRICE_USD && renewalUsd <= MAX_RENEWAL_PRICE_USD) {
        foundAvailable.push({ domain, priceUsd, renewalUsd, buyUrl });
        await sendEmailAlert(domain, priceUsd, renewalUsd, buyUrl);
      } else {
        console.log(`[i] Skipped ${domain} (Price: $${priceUsd}, Renewal: $${renewalUsd} exceeds limit)`);
      }
    } else {
      process.stdout.write(`.`);
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\nScan finished. Total dropped high-value domains found: ${foundAvailable.length}`);
  return foundAvailable;
}

runScan();
