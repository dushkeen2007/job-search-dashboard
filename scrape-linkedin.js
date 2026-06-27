// Runs the Apify LinkedIn Jobs scraper and saves results to linkedin-jobs.json
const https = require('https');
const fs    = require('fs');

const APIFY_TOKEN  = process.env.APIFY_API_KEY;
const ACTOR_ID     = 'curious_coder~linkedin-jobs-scraper';
const OUTPUT_FILE  = 'linkedin-jobs.json';
const SEARCH_URL   = 'https://www.linkedin.com/jobs/search/?keywords=product%20designer&location=United%20States&geoId=103644278&f_TPR=r604800';
const MAX_JOBS     = 100;
const POLL_MS      = 8000;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function startRun() {
  const res = await request({
    hostname: 'api.apify.com',
    path: `/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    searchUrls: [{ url: SEARCH_URL }],
    maxJobs: MAX_JOBS
  });
  if (res.status !== 201) throw new Error('Failed to start run: ' + JSON.stringify(res.body));
  return res.body.data.id;
}

async function pollRun(runId) {
  while (true) {
    const res = await request({
      hostname: 'api.apify.com',
      path: `/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`,
      method: 'GET'
    });
    const status = res.body.data.status;
    console.log(`Run status: ${status}`);
    if (status === 'SUCCEEDED') return res.body.data.defaultDatasetId;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) throw new Error(`Run ${status}`);
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

async function fetchResults(datasetId) {
  const res = await request({
    hostname: 'api.apify.com',
    path: `/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`,
    method: 'GET'
  });
  return res.body;
}

function normalize(items) {
  return items.map((j, i) => ({
    id:            `li-${j.id || i}`,
    title:         j.title || j.positionName || '',
    company:       j.companyName || j.company || '',
    location:      j.location || '',
    locationType:  (j.workType || j.location || '').toLowerCase().includes('remote') ? 'remote'
                 : (j.workType || '').toLowerCase().includes('hybrid') ? 'hybrid' : 'on-site',
    isRemote:      (j.workType || j.location || '').toLowerCase().includes('remote'),
    salaryDisplay: j.salary || 'Not listed',
    salaryData:    0,
    posted:        j.postedAt ? Math.max(0, Math.floor((Date.now() - new Date(j.postedAt)) / 86400000)) : 0,
    added:         j.postedAt || new Date().toISOString(),
    url:           j.jobUrl || j.url || '#',
    description:   (j.descriptionText || j.description || '').slice(0, 3000)
  }));
}

(async () => {
  if (!APIFY_TOKEN) { console.error('APIFY_API_KEY not set'); process.exit(1); }
  console.log('Starting Apify LinkedIn Jobs run…');
  const runId     = await startRun();
  console.log(`Run started: ${runId}`);
  const datasetId = await pollRun(runId);
  console.log(`Fetching results from dataset: ${datasetId}`);
  const raw       = await fetchResults(datasetId);
  const jobs      = normalize(raw);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(jobs, null, 2));
  console.log(`Saved ${jobs.length} jobs to ${OUTPUT_FILE}`);
})();
