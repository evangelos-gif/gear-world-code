// The seasonal banner at the top of the deals pages (/discount-codes/ and /deals/), see src/lib/seasons.js.
// The server writes the still picture and the text (translated by the site script like every other text). The site
// script (assets/site.js, setupSeason) adds the muted video loop after the page has loaded, only when the visitor
// can afford it (not with "reduce motion", Save-Data or a slow connection), keeps the countdown up to date and
// handles the Pause button.
import { html } from '../lib/html.js';
import { tr } from './layout.js';
import { seasonFor, seasonMedia, countdownLeft } from '../lib/seasons.js';

const ukDate = day => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${day}T12:00:00Z`));

export function countdownHtml(season, now) {
  const left = countdownLeft(season, now);
  if (!left) return '';
  return left.d > 0 ? tr('Ends in {0} d {1} h {2} min', left.d, left.h, left.m) : tr('Ends in {0} h {1} min', left.h, left.m);
}

// target: the id of the part of the page the button goes to (the codes, or the products).
export function seasonBanner(site, target, now = Date.now()) {
  const season = seasonFor(now);
  if (!season) return '';
  const count = countdownHtml(season, now);
  return html`<section class="season-banner season-${season.id}${season.mirror ? ' season-mirror' : ''}" aria-label="Seasonal offers"
    data-season="${season.id}" data-season-video="${seasonMedia(season, 'mp4')}" data-season-poster="${seasonMedia(season, 'jpg')}"${season.countdownTo ? html` data-season-countdown="${season.countdownTo}"` : ''}>
  <img class="season-media" src="${seasonMedia(season, 'jpg')}" alt="" width="960" height="528" decoding="async">
  <div class="season-shade"></div>
  <div class="season-text">
    <p class="season-eyebrow">${tr(season.name)} · ${tr('Until {0}', { text: ukDate(season.end), date: season.end })}</p>
    <h2 class="season-title">${tr(season.title)}</h2>
    ${season.countdownTo ? html`<p class="season-count" data-season-count${count ? '' : ' hidden'}>${count}</p>` : ''}
    <a class="btn btn-gold" href="#${target}">${tr('See the deals')}</a>
  </div>
  <button type="button" class="season-pause" data-season-pause hidden><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>${tr('Pause')}</span></button>
</section>`;
}
