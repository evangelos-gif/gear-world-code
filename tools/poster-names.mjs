#!/usr/bin/env node
// The poster names and the sites that the counter Worker gear-world-posters knows in this repo version (src/posters.js),
// for tools/poster-setup.ps1 -Step counter. READ-ONLY, nothing goes online.
// Usage: node tools/poster-names.mjs     prints two lines: "sites=hub,cgw,..." and "campaigns=poster10,..."
import { SITES, CAMPAIGNS } from '../src/posters.js';

process.stdout.write('sites=' + SITES.join(',') + '\n' + 'campaigns=' + CAMPAIGNS.join(',') + '\n');
