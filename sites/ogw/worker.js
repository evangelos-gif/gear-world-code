// Mega Stores Gear World Worker: gift guides, legal pages, robots.txt and sitemap. Static files come from public/.
import { createGuidesWorker } from '../../src/marketplace-guides.js';
import site from './site.config.js';

export default createGuidesWorker(site);
