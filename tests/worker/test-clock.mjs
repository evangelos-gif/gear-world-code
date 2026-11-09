// The unit tests run on a fixed day (lessons L107): the test data was made on 18-20 Oct 2026, and the sites hide a
// product whose price was last checked more than 30 days ago and say "Check price and stock at the retailer" after 14.
// Without a fixed day the same tests would give other pages as the weeks go by. package.json loads this file first in
// every test process (node --import); a test that needs another day calls useClock() itself. The live Worker never
// loads it (the local checks use the variable GW_TODAY on localhost instead).
import { useClock } from '../../src/lib/visibility.js';

export const TEST_DAY = '2026-10-21';
useClock(() => Date.parse(`${TEST_DAY}T12:00:00Z`));
