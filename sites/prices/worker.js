// gear-world-prices: the private Worker that logs the prices of the 13 Gear World sites once a day (lessons L100).
// No public address (no routes, workers.dev and preview addresses off): it only runs on its cron, every 15 minutes,
// one site per run. It reads the sites' databases with SELECT only and writes only to gear-world-prices.
import { runOnce } from './price-log.js';

export default {
  async fetch() {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  },
  async scheduled(controller, env) {
    const result = await runOnce(env, { now: controller.scheduledTime });
    console.log(JSON.stringify({ priceLog: result }));
  }
};
