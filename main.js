import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset, sleep } from 'crawlee';

await Actor.init();

const INPUT = await Actor.getInput() ?? {};
const { category = 'christianchurch', stateFilter = [], maxPages = 0, delayMs = 1500 } = INPUT;

const CATEGORY_URLS = {
    christianchurch: 'https://christianstandard.com/places/category/christianchurch/',
    churchofchrist: 'https://christianstandard.com/places/category/churchofchrist/',
    missionorganization: 'https://christianstandard.com/places/category/missionorganization/',
};

const BASE_URL = CATEGORY_URLS[category];
if (!BASE_URL) throw new Error('Unknown category: ' + category);

function getStateFromCoords(lat, lng) {
    if (!lat || !lng) return '';
    const states = [
        { s:'ME', lat:[43.0,47.5], lng:[-71.1,-66.9] },
        { s:'NH', lat:[42.7,45.3], lng:[-72.6,-70.6] },
        { s:'VT', lat:[42.7,45.0], lng:[-73.4,-71.5] },
        { s:'MA', lat:[41.2,42.9], lng:[-73.5,-69.9] },
        { s:'RI', lat:[41.1,42.0], lng:[-71.9,-71.1] },
        { s:'CT', lat:[40.9,42.1], lng:[-73.7,-71.8] },
        { s:'NY', lat:[40.5,45.0], lng:[-79.8,-71.9] },
        { s:'NJ', lat:[38.9,41.4], lng:[-75.6,-73.9] },
        { s:'PA', lat:[39.7,42.3], lng:[-80.5,-74.7] },
        { s:'DE', lat:[38.4,39.8], lng:[-75.8,-75.0] },
        { s:'MD', lat:[37.9,39.7], lng:[-79.5,-75.0] },
        { s:'VA', lat:[36.5,39.5], lng:[-83.7,-75.2] },
        { s:'WV', lat:[37.2,40.6], lng:[-82.6,-77.7] },
        { s:'NC', lat:[33.8,36.6], lng:[-84.3,-75.5] },
        { s:'SC', lat:[32.0,35.2], lng:[-83.4,-78.5] },
        { s:'GA', lat:[30.4,35.0], lng:[-85.6,-80.8] },
        { s:'FL', lat:[24.4,31.0], lng:[-87.6,-80.0] },
        { s:'AL', lat:[30.2,35.0], lng:[-88.5,-84.9] },
        { s:'MS', lat:[30.2,35.0], lng:[-91.7,-88.1] },
        { s:'TN', lat:[34.9,36.7], lng:[-90.3,-81.6] },
        { s:'KY', lat:[36.5,39.1], lng:[-89.6,-81.9] },
        { s:'OH', lat:[38.4,42.0], lng:[-84.8,-80.5] },
        { s:'IN', lat:[37.8,41.8], lng:[-88.1,-84.8] },
        { s:'MI', lat:[41.7,48.3], lng:[-90.4,-82.4] },
        { s:'WI', lat:[42.5,47.1], lng:[-92.9,-86.8] },
        { s:'IL', lat:[36.9,42.5], lng:[-91.5,-87.0] },
        { s:'MN', lat:[43.5,49.4], lng:[-97.2,-89.5] },
        { s:'IA', lat:[40.4,43.5], lng:[-96.6,-90.1] },
        { s:'MO', lat:[36.0,40.6], lng:[-95.8,-89.1] },
        { s:'AR', lat:[33.0,36.5], lng:[-94.6,-89.6] },
        { s:'LA', lat:[28.9,33.0], lng:[-94.0,-88.8] },
        { s:'ND', lat:[45.9,49.0], lng:[-104.1,-96.6] },
        { s:'SD', lat:[42.5,45.9], lng:[-104.1,-96.4] },
        { s:'NE', lat:[40.0,43.0], lng:[-104.1,-95.3] },
        { s:'KS', lat:[36.9,40.0], lng:[-102.1,-94.6] },
        { s:'OK', lat:[33.6,37.0], lng:[-103.0,-94.4] },
        { s:'TX', lat:[25.8,36.5], lng:[-106.6,-93.5] },
        { s:'MT', lat:[44.4,49.0], lng:[-116.1,-104.0] },
        { s:'WY', lat:[41.0,45.0], lng:[-111.1,-104.1] },
        { s:'CO', lat:[37.0,41.0], lng:[-109.1,-102.0] },
        { s:'NM', lat:[31.3,37.0], lng:[-109.1,-103.0] },
        { s:'AZ', lat:[31.3,37.0], lng:[-114.8,-109.0] },
        { s:'UT', lat:[37.0,42.0], lng:[-114.1,-109.0] },
        { s:'NV', lat:[35.0,42.0], lng:[-120.0,-114.0] },
        { s:'ID', lat:[42.0,49.0], lng:[-117.2,-111.0] },
        { s:'WA', lat:[45.5,49.0], lng:[-124.7,-116.9] },
        { s:'OR', lat:[42.0,46.2], lng:[-124.6,-116.5] },
        { s:'CA', lat:[32.5,42.0], lng:[-124.4,-114.1] },
        { s:'AK', lat:[54.0,71.4], lng:[-168.0,-130.0] },
        { s:'HI', lat:[18.9,22.2], lng:[-160.2,-154.8] },
        { s:'DC', lat:[38.8,39.0], lng:[-77.1,-76.9] },
    ];
    for (const { s, lat: [minLat, maxLat], lng: [minLng, maxLng] } of states) {
        if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) return s;
    }
    return '';
}

const MAX_SAFE_PAGES = maxPages > 0 ? maxPages : 500;
const startUrls = [];
for (let page = 1; page <= MAX_SAFE_PAGES; page++) {
    const url = page === 1 ? BASE_URL : BASE_URL + 'page/' + page + '/';
    startUrls.push({ url, label: 'LIST', userData: { page } });
}

console.log('Starting scrape. Category: ' + category + ' | States: ' + (stateFilter.length ? stateFilter.join(', ') : 'ALL'));

const crawler = new PlaywrightCrawler({
    proxyConfiguration: await Actor.createProxyConfiguration({ groups: ['RESIDENTIAL'] }),
    launchContext: {
        launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
        },
    },
    preNavigationHooks: [
        async ({ page }) => {
            await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });
        },
    ],
    maxConcurrency: 2,
    requestHandlerTimeoutSecs: 60,
    maxRequestRetries: 3,

    async requestHandler({ request, page, enqueueLinks, log }) {
        const { label, page: pageNum } = request.userData;
        await sleep(delayMs);

        if (label === 'LIST') {
            log.info('List page ' + pageNum + ': ' + request.url);
            try {
                await page.waitForSelector('h2 a[href*="/places/"]', { timeout: 15000 });
            } catch {
                log.info('No listings on page ' + pageNum + ' — done.');
                return;
            }
            const churchLinks = await page.evaluate(() => {
                const links = [];
                document.querySelectorAll('h2 a[href*="/places/"]').forEach(el => {
                    const href = el.href;
                    if (href && !href.includes('/places/category/') && !href.endsWith('/places/')) {
                        links.push(href);
                    }
                });
                return [...new Set(links)];
            });
            if (churchLinks.length === 0) { log.info('No links — done.'); return; }
            log.info('Found ' + churchLinks.length + ' churches on page ' + pageNum);
            for (const url of churchLinks) {
                await enqueueLinks({
                    urls: [url],
                    label: 'DETAIL',
                    transformRequestFunction: (req) => { req.userData = { label: 'DETAIL' }; return req; },
                });
            }

        } else if (label === 'DETAIL') {
            log.info('Scraping: ' + request.url);
            await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
            await sleep(2000);

            const record = await page.evaluate(() => {
                const getText = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : ''; };
                const bodyText = document.body.innerText;

                if (bodyText.includes('Error code 521') || bodyText.includes('Web server is down')) return null;

                const name = getText('h1') || document.title.split(' - ')[0];
                const categoryEl = document.querySelector('a[href*="/places/category/"]');
                const churchCategory = categoryEl ? categoryEl.textContent.trim() : '';

                const phoneEl = document.querySelector('a[href^="tel:"]');
                const rawPhone = phoneEl ? phoneEl.textContent.trim() : '';
                const phone = (rawPhone === '217-627-6766') ? '' : rawPhone;

                const emailEl = document.querySelector('a[href^="mailto:"]');
                const email = emailEl ? emailEl.href.replace('mailto:', '').trim() : '';

                let website = '';
                document.querySelectorAll('a[target="_blank"]').forEach(el => {
                    const href = el.href || '';
                    if (href &&
                        !href.includes('christianstandard.com') &&
                        !href.includes('facebook.com') &&
                        !href.includes('twitter.com') &&
                        !href.includes('instagram.com') &&
                        !href.includes('youtube.com') &&
                        !href.includes('maps.google.com') &&
                        !href.includes('connectmy.church') &&
                        !href.startsWith('mailto:') &&
                        !href.startsWith('tel:') &&
                        !website) { website = href; }
                });
                document.querySelectorAll('a').forEach(el => {
                    if (el.textContent.trim().toLowerCase() === 'website' && !website) {
                        const href = el.href || '';
                        if (!href.includes('maps.google.com') && !href.includes('connectmy.church')) website = href;
                    }
                });

                const facebook = document.querySelector('a[href*="facebook.com/"]:not([href*="ChristianStandard"])')?.href || '';
                const instagram = document.querySelector('a[href*="instagram.com/"]:not([href*="christianstandard"])')?.href || '';
                const youtube = document.querySelector('a[href*="youtube.com/"]:not([href*="christianstandard"])')?.href || '';

                let mapsUrl = '';
                document.querySelectorAll('a[href*="maps.google.com"]').forEach(el => { if (!mapsUrl) mapsUrl = el.href; });
                document.querySelectorAll('iframe[src*="maps.google.com"], iframe[src*="google.com/maps"]').forEach(el => { if (!mapsUrl) mapsUrl = el.src; });

                let lat = null, lng = null;
                if (mapsUrl) {
                    const llMatch = mapsUrl.match(/ll=([-\d.]+),([-\d.]+)/);
                    if (llMatch) { lat = parseFloat(llMatch[1]); lng = parseFloat(llMatch[2]); }
                    const qMatch = mapsUrl.match(/q=([-\d.]+),([-\d.]+)/);
                    if (qMatch && !lat) { lat = parseFloat(qMatch[1]); lng = parseFloat(qMatch[2]); }
                }

                const sizeMatch = bodyText.match(/Church Size:\s*([^\n]+)/);
                const churchSize = sizeMatch ? sizeMatch[1].trim() : '';
                const description = getText('.geodir-field-post_content, .gd-post-content, .geodir-description');

                const staff = [];
                bodyText.split(/(?=Name:)/).forEach(block => {
                    if (!block.includes('Name:')) return;
                    const nameMatch = block.match(/Name:\s*(.+)/);
                    const posMatch = block.match(/Position:\s*(.+)/);
                    const emailMatch = block.match(/Email:\s*(.+)/);
                    const phoneMatch = block.match(/Phone:\s*(.+)/);
                    if (nameMatch) {
                        staff.push({
                            name: nameMatch[1].trim(),
                            position: posMatch ? posMatch[1].trim() : '',
                            email: emailMatch ? emailMatch[1].trim() : '',
                            phone: phoneMatch ? phoneMatch[1].trim() : '',
                        });
                    }
                });

                return { name, churchCategory, phone, email, website, facebook, instagram, youtube, churchSize, description, staff, lat, lng, mapsUrl, sourceUrl: window.location.href };
            });

            if (!record) { log.info('Skipping error page: ' + request.url); return; }

            const state = getStateFromCoords(record.lat, record.lng);

            if (stateFilter.length > 0 && state) {
                const normalizedFilter = stateFilter.map(s => s.toUpperCase());
                if (!normalizedFilter.includes(state)) {
                    log.info('Skipping ' + record.name + ' (' + state + ')');
                    return;
                }
            }

            await Dataset.pushData({
                name: record.name,
                category: record.churchCategory || category,
                state,
                lat: record.lat,
                lng: record.lng,
                phone: record.phone,
                email: record.email,
                website: record.website,
                facebook: record.facebook,
                instagram: record.instagram,
                youtube: record.youtube,
                churchSize: record.churchSize,
                description: record.description ? record.description.substring(0, 500) : '',
                staffCount: record.staff.length,
                staff: record.staff,
                sourceUrl: record.sourceUrl,
                scrapedAt: new Date().toISOString(),
            });
            log.info('✓ Saved: ' + record.name + ' | ' + state);
        }
    },
    failedRequestHandler({ request, log }) { log.error('Failed: ' + request.url); },
});

await crawler.run(startUrls);
console.log('Scrape complete.');
await Actor.exit();
