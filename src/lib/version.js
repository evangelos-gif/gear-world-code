// Which code version is live (lessons L156). Every deploy tool writes its commit into the Worker
// (wrangler deploy --var GW_COMMIT:<commit>) and, before the next live update, reads it back here and asks GitHub
// whether the new version contains it: a version that does not is refused (tools/lib/live-guard.ps1), so live work
// such as the Group map (L152) is never undone by a deploy from an older branch (14 and 15 Nov 2026).
import { jsonResponse } from './http.js';

export function liveCommit(env) {
  const c = env && typeof env.GW_COMMIT === 'string' ? env.GW_COMMIT : '';
  return /^[0-9a-f]{40}$/.test(c) ? c : null;
}

export function versionResponse(env) {
  return jsonResponse({ commit: liveCommit(env) }, { cache: 'none' });
}
