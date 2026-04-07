import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset } from 'crawlee';

await Actor.init();

const INPUT = await Actor.getInput();
console.log('INPUT RECEIVED:', JSON.stringify(INPUT));

const url = 'https://christianstandard.com/places/category/christianchurch/';
console.log('About to crawl:', url);

const crawler = new PlaywrightCrawler({
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
            ],
        },
    },
    preNavigationHooks: [
        async ({ page }) => {
            // Mask automation signals
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
            });
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });
        },
    ],
    browserPoolOptions: {
        useFingerprints: true,
    },
    maxRequestsPerCrawl: 1,
    async requestHandler({ page, log }) {
        log.info('PAGE LOADED: ' + page.url());
        const title = await page.title();
        log.info('PAGE TITLE: ' + title);
        const links = await page.$$eval('a[href*="/places/"]', els => els.map(e => e.href));
        log.info('FOUND LINKS: ' + links.length);
        links.slice(0, 5).forEach(l => log.info('  LINK: ' + l));
        await Dataset.pushData({ url: page.url(), title, linkCount: links.length });
    },
    failedRequestHandler({ request, log }) {
        log.error('FAILED: ' + request.url + ' — ' + request.errorMessages?.join(', '));
    },
});

console.log('Starting crawler...');
await crawler.run([{ url }]);
console.log('Crawler finished.');

await Actor.exit();
