const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL       = 'dushkeen2007@gmail.com';

const EXCLUDE = ['engineer','developer','manager','director','researcher',
                 'writer','intern','junior','coordinator'];
const INCLUDE = ['product designer','ux designer','ui designer','staff designer',
                 'principal designer','senior designer','senior product','lead designer'];

const EXCLUDE_LOCATIONS = ['germany','ireland','netherlands','portugal','spain',
                           'united kingdom',' uk','france','australia','canada',
                           'india','brazil','japan','emea','europe'];

const US_STATES = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

const GH_SLUGS  = ['figma','stripe','vercel','airtable','webflow','brex','intercom','dropbox',
                   'mercury','descript','typeform','greenhouse','upwork','instacart',
                   'pinterest','opentable','calm','squarespace'];
const GH_NAMES  = { figma:'Figma', stripe:'Stripe', vercel:'Vercel', airtable:'Airtable',
                    webflow:'Webflow', brex:'Brex', intercom:'Intercom', dropbox:'Dropbox',
                    mercury:'Mercury', descript:'Descript', typeform:'Typeform',
                    greenhouse:'Greenhouse', upwork:'Upwork', instacart:'Instacart',
                    pinterest:'Pinterest', opentable:'OpenTable',
                    calm:'Calm', squarespace:'Squarespace' };

const ASHBY_SLUGS = ['notion','linear','ramp','fathom.video','dovetail','betterup','zapier','monarchmoney'];
const ASHBY_NAMES = { notion:'Notion', linear:'Linear', ramp:'Ramp', 'fathom.video':'Fathom',
                      dovetail:'Dovetail', betterup:'BetterUp', zapier:'Zapier', monarchmoney:'Monarch' };

function passesTitle(t) {
  const s = t.toLowerCase();
  if (EXCLUDE.some(w => s.includes(w))) return false;
  return INCLUDE.some(w => s.includes(w));
}

function isUSOrRemote(loc, isRemote) {
  if (isRemote) return true;
  if (!loc) return true;
  const s = loc.toLowerCase();
  if (/\b(united states|north america|americas|worldwide|anywhere|global)\b/.test(s)) return true;
  if (EXCLUDE_LOCATIONS.some(term => s.includes(term))) return false;
  if (/\b(us|remote)\b/.test(s)) return true;
  if (US_STATES.test(loc)) return true;
  return false;
}

function daysAgo(dateStr) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

async function fetchGreenhouse() {
  const results = await Promise.allSettled(
    GH_SLUGS.map(slug =>
      fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => (data.jobs || []).map(j => ({
          title:    j.title || '',
          company:  GH_NAMES[slug],
          location: j.location?.name || '',
          isRemote: false,
          posted:   daysAgo(j.updated_at),
          url:      j.absolute_url || '#'
        })))
    )
  );
  return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

async function fetchAshby() {
  const results = await Promise.allSettled(
    ASHBY_SLUGS.map(slug =>
      fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => (data.jobs || []).map(j => ({
          title:    j.title || '',
          company:  ASHBY_NAMES[slug],
          location: j.location || '',
          isRemote: j.isRemote || false,
          posted:   daysAgo(j.publishedAt),
          url:      j.jobUrl || '#'
        })))
    )
  );
  return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

function deduplicate(jobs) {
  const seen = new Set();
  return jobs.filter(j => {
    const key = `${j.title.toLowerCase()}|${j.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildEmailHtml(jobs, dateRange) {
  if (!jobs.length) {
    return `<div style="background:#09090b;padding:32px;font-family:ui-sans-serif,system-ui,sans-serif;">
      <p style="color:#71717a;font-size:14px;margin:0;">No matching roles this week.</p>
    </div>`;
  }

  const cards = jobs.map(j => `
    <div style="background:#111114;border:1px solid #1f1f23;border-radius:10px;padding:16px 20px;margin-bottom:10px;">
      <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#fafafa;font-family:ui-sans-serif,system-ui,sans-serif;letter-spacing:-0.01em;">${j.title}</p>
      <p style="margin:0 0 12px;font-size:13px;color:#a1a1aa;font-family:ui-sans-serif,system-ui,sans-serif;">${j.company}&nbsp;&middot;&nbsp;${j.location || 'Remote'}&nbsp;&middot;&nbsp;${j.posted === 0 ? 'today' : j.posted === 1 ? '1d ago' : `${j.posted}d ago`}</p>
      <a href="${j.url}" style="display:inline-block;padding:6px 14px;background:#f59e0b;color:#1a1206;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;font-family:ui-sans-serif,system-ui,sans-serif;">View listing</a>
    </div>
  `).join('');

  return `
    <div style="background:#09090b;margin:0;padding:0;">
      <div style="max-width:600px;margin:0 auto;padding:32px 24px;font-family:ui-sans-serif,system-ui,sans-serif;">
        <div style="margin-bottom:24px;">
          <span style="display:inline-block;width:32px;height:32px;background:#f59e0b;border-radius:6px;font-size:16px;font-weight:700;color:#1a1206;text-align:center;line-height:32px;vertical-align:middle;">H</span>
          <span style="display:inline-block;font-size:16px;font-weight:600;color:#fafafa;vertical-align:middle;margin-left:8px;letter-spacing:-0.01em;">Hunt</span>
        </div>
        <h2 style="font-size:18px;font-weight:600;color:#fafafa;margin:0 0 4px;letter-spacing:-0.01em;">Job digest</h2>
        <p style="font-size:13px;color:#71717a;margin:0 0 24px;">${dateRange}</p>
        ${cards}
        <p style="font-size:12px;color:#52525b;margin-top:20px;">${jobs.length} ${jobs.length === 1 ? 'role' : 'roles'} posted in the last 7 days.</p>
      </div>
    </div>
  `;
}

async function main() {
  const [gh, ashby] = await Promise.allSettled([fetchGreenhouse(), fetchAshby()]);

  let jobs = [
    ...(gh.status    === 'fulfilled' ? gh.value    : []),
    ...(ashby.status === 'fulfilled' ? ashby.value : [])
  ];

  jobs = jobs.filter(j => j.posted <= 7);
  jobs = jobs.filter(j => passesTitle(j.title));
  jobs = jobs.filter(j => isUSOrRemote(j.location, j.isRemote));
  jobs = deduplicate(jobs);
  jobs.sort((a, b) => a.posted - b.posted);

  const today     = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const weekAgo   = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const dateRange = `${weekAgo} – ${today}`;

  const html = buildEmailHtml(jobs, dateRange);

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Hunt Job board <onboarding@resend.dev>',
      to:      TO_EMAIL,
      subject: `Hunt Job board — Product designer digest ${today}`,
      html
    })
  });

  const data = await res.json();
  if (!res.ok) { console.error('Resend error:', data); process.exit(1); }
  console.log('Email sent successfully:', data.id);
}

main();
