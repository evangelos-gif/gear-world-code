// gear-world-network-sync: copies the sales of CJ, Daisycon and Linkwise (and later networks) of every Gear World site
// into the D1 database gear-world-awin, next to the Awin sales, every 2 hours (lessons L197). See src/network-sync.js.
import { createNetworkSync } from '../../src/network-sync.js';

export default createNetworkSync();
