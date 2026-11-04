// Gear World Hub: sitemap.xml, served by this small Worker on the route gearworldhub.com/sitemap.xml.
// The Hub's own code is not touched. To undo: delete the route (or this Worker).
const PAGES = ["/", "/privacy/", "/terms/", "/cookies/", "/contact/", "/affiliate-disclosure/"];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/sitemap.xml") return new Response("Not found", { status: 404 });
    const urls = PAGES.map((p) => "  <url><loc>https://gearworldhub.com" + p + "</loc></url>").join("\n");
    const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n";
    return new Response(request.method === "HEAD" ? null : body, {
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" }
    });
  }
};
