import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset } from 'crawlee';

await Actor.init();

const INPUT = await Actor.getInput();
console.log('INPUT RECEIVED:', JSON.stringify(INPUT));

const url = 'https://christianstandard.com/places/category/christianchurch/';
console.log('About to crawl:', url);

const crawler = new PlaywrightCrawler({
    launchContext: { launchOptions: { headless: true } },
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
});

console.log('Starting crawler...');
await crawler.run([{ url }]);
console.log('Crawler finished.');

const info = await Dataset.getInfo();
console.log('DATASET COUNT:', info?.itemCount);

await Actor.exit();
