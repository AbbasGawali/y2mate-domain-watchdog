import fs from 'node:fs';

const GODADDY_TOKEN = process.env.GODADDY_TOKEN || 'gd_pat_mkTG9UGo5YyNUITj2bCJLPsswGYYYnzGdfDGBYyPGyb_08c1b0ac';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'abbasgawali111@gmail.com';
const MAX_FIRST_YEAR_PRICE_USD = 10; // Under ~$10 (₹850)
const MAX_RENEWAL_PRICE_USD = 30;    // Under ~$30 (₹2,500)

// Top 45 cheap, brandable generic TLDs worth watching for y2mate
const TLDS_TO_MONITOR = [
  'uno', 'skin', 'link', 'click', 'fun', 'site', 'online', 'space',
  'top', 'icu', 'pro', 'live', 'download', 'vip', 'lat', 'to',
  'digital', 'stream', 'app', 'cloud', 'buzz', 'zone', 'best', 'run',
  'cool', 'pw', 'world', 'today', 'media', 'network', 'center',
  'tech', 'info', 'cc', 'me', 'one', 'plus', 'direct', 'tube', 'video',
  'works', 'services', 'tools', 'co', 'io'
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
  console.log(`\n🚨 SENDING URGENT EMAIL ALERT FOR: ${domain} (Price: $${priceUsd}) 🚨`);
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
        _subject: `🚨 URGENT: ${domain} IS AVAILABLE TO BUY (₹${Math.round(priceUsd * 84)})!`,
        domain: domain,
        first_year_price: `$${priceUsd} (~₹${Math.round(priceUsd * 84)})`,
        renewal_price: `$${renewalUsd} (~₹${Math.round(renewalUsd * 84)})`,
        buy_direct_link: buyUrl,
        message: `Grab it immediately before bots do! Open link: ${buyUrl}`
      })
    });
    const data = await res.json();
    console.log('[✓] Alert email sent result:', data);
  } catch (err) {
    console.error('[!] Failed to send email alert:', err.message);
  }
}

async function runScan() {
  console.log(`[${new Date().toISOString()}] Starting scan of ${TLDS_TO_MONITOR.length} TLDs for y2mate...`);
  const foundAvailable = [];

  for (const tld of TLDS_TO_MONITOR) {
    const domain = `y2mate.${tld}`;
    const result = await checkDomain(domain);

    if (result && result.available) {
      const priceUsd = (result.price || 0) / 1000000;
      const renewalUsd = (result.renewalPrice || 0) / 1000000;
      const buyUrl = `https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${encodeURIComponent(domain)}`;

      console.log(`[★] AVAILABLE: ${domain} | Price: $${priceUsd} | Renewal: $${renewalUsd}`);

      // Check if within budget
      if (priceUsd <= MAX_FIRST_YEAR_PRICE_USD && renewalUsd <= MAX_RENEWAL_PRICE_USD) {
        foundAvailable.push({ domain, priceUsd, renewalUsd, buyUrl });
        await sendEmailAlert(domain, priceUsd, renewalUsd, buyUrl);
      } else {
        console.log(`[i] Skipped ${domain} due to price filter (Price: $${priceUsd}, Renewal: $${renewalUsd})`);
      }
    } else {
      process.stdout.write(`.`);
    }

    // Politeness delay between GoDaddy API queries
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\nScan finished. Total affordable domains found: ${foundAvailable.length}`);
  return foundAvailable;
}

runScan();
