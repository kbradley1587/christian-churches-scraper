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
