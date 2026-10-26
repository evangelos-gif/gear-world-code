document.querySelectorAll(".world-link").forEach((button) => {
  button.addEventListener("click", () => {
    const site = button.dataset.site;

    if (site === "cgw") {
      window.location.href = "https://constructiongearworld.com/";
      return;
    }

    if (site === "mgw") {
      window.location.href = "https://mensgearworld.com/";
      return;
    }

    if (site === "wgw") {
      window.location.href = "https://womensgearworld.com/";
      return;
    }

    if (site === "kgw") {
      window.location.href = "https://kidsgearworld.com/";
      return;
    }

    if (site === "hgw") {
      window.location.href = "https://homegearworld.com/";
      return;
    }

    if (site === "ggw") {
      window.location.href = "https://gardengearworld.com/";
      return;
    }
  });
});

const searchForm = document.getElementById("hubSearch");
const searchInput = document.getElementById("hubSearchInput");
const searchMessage = document.getElementById("searchMessage");

// ============================================================
// SEARCH RESULTS PANEL
// ============================================================

const searchStyle = document.createElement("style");
searchStyle.id = "gwh-product-search-style";
searchStyle.textContent = `
  .hub-search{
    position:relative;
  }

  .hub-search-results{
    position:absolute;
    z-index:1000;
    top:calc(100% + 9px);
    left:0;
    right:0;

    display:none;

    max-height:520px;
    overflow-y:auto;

    background:#ffffff;
    border:1px solid #d9e1ea;
    border-radius:14px;

    box-shadow:0 20px 50px rgba(0,0,0,.24);

    text-align:left;
  }

  .hub-search-results.is-open{
    display:block;
  }

  .gwh-search-summary{
    padding:13px 16px;
    border-bottom:1px solid #e7edf3;

    color:#526173;
    font-size:13px;
    font-weight:700;

    background:#f8fafc;
  }

  .gwh-search-item{
    display:grid;
    grid-template-columns:72px minmax(0,1fr) auto;
    gap:14px;
    align-items:center;

    padding:13px 15px;

    border-bottom:1px solid #edf1f5;

    text-decoration:none;
    color:#111827;

    transition:
      background .16s ease,
      transform .16s ease;
  }

  .gwh-search-item:last-child{
    border-bottom:0;
  }

  .gwh-search-item:hover{
    background:#f7fafc;
  }

  .gwh-search-image{
    width:72px;
    height:72px;

    object-fit:contain;

    background:#fff;
    border:1px solid #e3e8ef;
    border-radius:9px;
  }

  .gwh-search-image-placeholder{
    width:72px;
    height:72px;

    display:flex;
    align-items:center;
    justify-content:center;

    background:#eef2f6;
    border-radius:9px;

    color:#6b7280;
    font-size:11px;
    font-weight:800;
    text-align:center;
  }

  .gwh-search-details{
    min-width:0;
  }

  .gwh-search-source{
    display:inline-block;

    margin-bottom:5px;
    padding:3px 7px;

    background:#0d1b2a;
    color:#ffffff;

    border-radius:5px;

    font-size:10px;
    line-height:1.2;
    font-weight:900;
    letter-spacing:.04em;
    text-transform:uppercase;
  }

  .gwh-search-name{
    margin:0 0 5px;

    color:#111827;

    font-size:14px;
    line-height:1.32;
    font-weight:800;
  }

  .gwh-search-meta{
    color:#667085;

    font-size:12px;
    line-height:1.35;
  }

  .gwh-search-price{
    min-width:95px;

    color:#111827;

    font-size:15px;
    font-weight:900;
    text-align:right;
  }

  .gwh-search-view{
    display:block;

    margin-top:5px;

    color:#d48d00;

    font-size:11px;
    font-weight:900;
  }

  .gwh-search-empty,
  .gwh-search-error,
  .gwh-search-loading{
    padding:20px;

    color:#4b5563;

    font-size:14px;
    font-weight:700;
    text-align:center;
  }

  @media(max-width:650px){

    .hub-search-results{
      max-height:430px;
    }

    .gwh-search-item{
      grid-template-columns:58px minmax(0,1fr);
      gap:10px;
    }

    .gwh-search-image,
    .gwh-search-image-placeholder{
      width:58px;
      height:58px;
    }

    .gwh-search-price{
      grid-column:2;
      min-width:0;

      margin-top:3px;

      text-align:left;
    }

  }
`;

document.head.appendChild(searchStyle);

const resultsPanel = document.createElement("div");
resultsPanel.id = "hubSearchResults";
resultsPanel.className = "hub-search-results";
resultsPanel.setAttribute("role", "region");
resultsPanel.setAttribute("aria-label", "Product search results");

searchForm.appendChild(resultsPanel);

resultsPanel.setAttribute(
  "aria-label",
  window.GWH_t ? window.GWH_t("resultsAria") : "Product search results"
);

// GWH SEARCH LANGUAGE REFRESH
window.addEventListener("gwh-language-change", () => {
  resultsPanel.setAttribute("aria-label", t("resultsAria"));

  if (
    resultsPanel.classList.contains("is-open") &&
    searchInput.value.trim().length >= 2
  ) {
    searchForm.requestSubmit();
  }
});

// ============================================================
// HELPERS
// ============================================================

const t = (key, vars = {}) =>
  window.GWH_t ? window.GWH_t(key, vars) : key;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPrice(price, currency) {
  const amount = Number(price);
  const code = String(currency || "GBP").toUpperCase();

  if (!Number.isFinite(amount)) {
    return t("checkPrice");
  }

  try {
    return new Intl.NumberFormat(window.GWH_getLocale ? window.GWH_getLocale() : "en-GB", {
      style: "currency",
      currency: code
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function siteShortName(site) {
  // GWH-SHORT-NAMES (26/10/2026): every Gear World code is shown as its own short name
  // (CGW, MGW, WGW, KGW, HGW, GGW, TGW, AGW, VGW, SGW and any new world), not "GEAR WORLD".
  const code = String(site || "").trim().toLowerCase();
  if (/^[a-z]{3}$/.test(code)) return code.toUpperCase();
  return "GEAR WORLD";
}

function closeSearchResults() {
  resultsPanel.classList.remove("is-open");
}

function openSearchResults() {
  resultsPanel.classList.add("is-open");
}

// ============================================================
// REAL CROSS-SITE SEARCH
// ============================================================

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = searchInput.value.trim();

  if (!query) {
    searchMessage.textContent = "";
    resultsPanel.innerHTML = "";
    closeSearchResults();
    return;
  }

  if (query.length < 2) {
    searchMessage.textContent = t("min2");
    resultsPanel.innerHTML = "";
    closeSearchResults();
    return;
  }

  searchMessage.textContent = t("searchingAll", { query });

  resultsPanel.innerHTML = `
    <div class="gwh-search-loading">
      ${t("searchingWorlds")}
    </div>
  `;

  openSearchResults();

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Search returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || t("searchFailed"));
    }

    const results = Array.isArray(data.results)
      ? data.results
      : [];

    if (results.length === 0) {
      searchMessage.textContent =
        t("noProductsFor", { query });

      resultsPanel.innerHTML = `
        <div class="gwh-search-empty">
          ${t("noProductsAcross")}
        </div>
      `;

      openSearchResults();
      return;
    }

    const activeWorlds = Object.values(data.sites || {})
      .filter(count => Number(count) > 0)
      .length;

    searchMessage.textContent = t("productsFound", {
      count: results.length,
      worlds: activeWorlds
    });

    const items = results.map(product => {
      const image = product.image_url
        ? `
          <img
            class="gwh-search-image"
            src="${escapeHtml(product.image_url)}"
            alt="${escapeHtml(product.product_name)}"
            loading="lazy"
          >
        `
        : `
          <div class="gwh-search-image-placeholder">
            ${t("noImage")}
          </div>
        `;

      const brandRetailer = [
        product.brand,
        product.retailer
      ]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" · ");

      return `
        <a
          class="gwh-search-item"
          href="${escapeHtml(product.product_url)}"
        >

          ${image}

          <div class="gwh-search-details">

            <span class="gwh-search-source">
              ${escapeHtml(siteShortName(product.site))}
            </span>

            <div class="gwh-search-name">
              ${escapeHtml(product.product_name)}
            </div>

            <div class="gwh-search-meta">
              ${brandRetailer}
            </div>

          </div>

          <div class="gwh-search-price">
            ${escapeHtml(formatPrice(product.price, product.currency))}

            <span class="gwh-search-view">
              ${t("viewProduct")} →
            </span>
          </div>

        </a>
      `;
    }).join("");

    resultsPanel.innerHTML = `
      <div class="gwh-search-summary">
        ${t("showingResults", {
          count: results.length,
          query: escapeHtml(query)
        })}
      </div>

      ${items}
    `;

    openSearchResults();

  } catch (error) {
    console.error("Gear World Hub product search error:", error);

    searchMessage.textContent =
      t("searchUnavailable");

    resultsPanel.innerHTML = `
      <div class="gwh-search-error">
        ${t("loadError")}
      </div>
    `;

    openSearchResults();
  }
});

// ============================================================
// RESET / CLOSE
// ============================================================

searchInput.addEventListener("input", () => {
  if (searchInput.value.trim() === "") {
    searchMessage.textContent = "";
    resultsPanel.innerHTML = "";
    closeSearchResults();
  }
});

document.addEventListener("click", event => {
  if (!searchForm.contains(event.target)) {
    closeSearchResults();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeSearchResults();
    searchInput.blur();
  }
});