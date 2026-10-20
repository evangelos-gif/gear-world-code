// Gear World Group Worker: one company page, robots.txt and sitemap. Static files come from public/.
import { createGroupWorker } from '../../src/group.js';
import site from './site.config.js';

export default createGroupWorker(site);
