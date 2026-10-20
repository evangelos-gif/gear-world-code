// Home Gear World Worker: the shared engine with this site's config.
import { createWorker } from '../../src/engine.js';
import site from './site.config.js';

export default createWorker(site);
