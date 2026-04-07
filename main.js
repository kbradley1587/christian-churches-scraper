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

const STATE_ABBREVS = {'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'};

function parseState(addressText) {
    if (!addressText) return '';
    const abbrevMatch = addressText.match(/,\s*([A-Z]{2})\s*\d{5}/);
    if (abbrevMatch) return abbrevMatch[1];
    for (const [name, abbrev] of Object.entries(STATE_ABBREVS)) {
        if (addressText.includes(name)) return abbrev;
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
    proxyConfiguration: await Actor.createProxyConfiguration({
        groups: ['RESIDENTIAL'],
    }),
    launchContext: {
        launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
        },
    },
    preNavigationHooks: [
        async ({ page }) => {
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            });
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
            if (churchLinks.length === 0) { log.info('No links — pagination complete.'); return; }
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
                const getAttr = (sel, attr) => { const el = document.querySelector(sel); return el ? (el.getAttribute(attr) || '').trim() : ''; };
                const name = getText('h1') || document.title.split(' - ')[0];
                const categoryEl = document.querySelector('a[href*="/places/category/"]');
                const churchCategory = categoryEl ? categoryEl.textContent.trim() : '';
                let streetAddress = '', city = '', stateRaw = '', zip = '', country = '';
                if (document.querySelector('[itemprop="address"]')) {
                    streetAddress = getText('[itemprop="streetAddress"]');
                    city = getText('[itemprop="addressLocality"]');
                    stateRaw = getText('[itemprop="addressRegion"]');
                    zip = getText('[itemprop="postalCode"]');
                    country = getText('[itemprop="addressCountry"]');
                }
                const addressBlock = getText('.geodir_post_meta_address, .gd-address, .geodir-address');
                const phoneEl = document.querySelector('a[href^="tel:"]');
                const phone = phoneEl ? phoneEl.textContent.trim() : '';
                const emailEl = document.querySelector('a[href^="mailto:"]');
                const email = emailEl ? emailEl.href.replace('mailto:', '').trim() : '';
                let website = '';
                document.querySelectorAll('a[target="_blank"]').forEach(el => {
                    const href = el.href || '';
                    if (href && !href.includes('christianstandard.com') && !href.includes('facebook.com') && !href.includes('twitter.com') && !href.includes('instagram.com') && !href.includes('youtube.com') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !website) { website = href; }
                });
                document.querySelectorAll('a').forEach(el => { if (el.textContent.trim().toLowerCase() === 'website' && !website) { website = el.href; } });
                const facebook = getAttr('a[href*="facebook.com"]', 'href');
                const instagram = getAttr('a[href*="instagram.com"]', 'href');
                const youtube = getAttr('a[href*="youtube.com"]', 'href');
                const sizeMatch = document.body.innerText.match(/Church Size:\s*([^\n]+)/);
                const churchSize = sizeMatch ? sizeMatch[1].trim() : '';
                const description = getText('.geodir-field-post_content, .gd-post-content, .geodir-description');
                const staff = [];
                const staffBlocks = document.body.innerText.split(/(?=Name:)/);
                staffBlocks.forEach(block => {
                    if (!block.includes('Name:')) return;
                    const nameMatch = block.match(/Name:\s*(.+)/);
                    const posMatch = block.match(/Position:\s*(.+)/);
                    const emailMatch = block.match(/Email:\s*(.+)/);
                    const phoneMatch = block.match(/Phone:\s*(.+)/);
                    if (nameMatch) { staff.push({ name: nameMatch[1].trim(), position: posMatch ? posMatch[1].trim() : '', email: emailMatch ? emailMatch[1].trim() : '', phone: phoneMatch ? phoneMatch[1].trim() : '' }); }
                });
                return { name, churchCategory, streetAddress, city, stateRaw, zip, country, addressBlock, phone, email, website, facebook, instagram, youtube, churchSize, description, staff, sourceUrl: window.location.href };
            });

            let state = record.stateRaw;
            if (!state) state = parseState(record.addressBlock);
            if (state.length > 2) state = STATE_ABBREVS[state] || state;
            record.state = state.toUpperCase();

            if (stateFilter.length > 0) {
                const normalizedFilter = stateFilter.map(s => s.toUpperCase());
                if (!normalizedFilter.includes(record.state)) { log.info('Skipping ' + record.name + ' (' + record.state + ')'); return; }
            }

            await Dataset.pushData({
                name: record.name, category: record.churchCategory || category,
                state: record.state, city: record.city,
                streetAddress: record.streetAddress, zip: record.zip,
                fullAddress: record.addressBlock || (record.streetAddress + ', ' + record.city + ', ' + record.stateRaw + ' ' + record.zip),
                phone: record.phone, email: record.email, website: record.website,
                facebook: record.facebook, instagram: record.instagram, youtube: record.youtube,
                churchSize: record.churchSize,
                description: record.description ? record.description.substring(0, 500) : '',
                staffCount: record.staff.length, staff: record.staff,
                sourceUrl: record.sourceUrl, scrapedAt: new Date().toISOString(),
            });
            log.info('✓ Saved: ' + record.name + ' | ' + record.city + ', ' + record.state);
        }
    },
    failedRequestHandler({ request, log }) { log.error('Failed: ' + request.url); },
});

await crawler.run(startUrls);
console.log('Scrape complete.');
await Actor.exit();
