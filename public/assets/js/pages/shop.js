import { html, $, $$, esc } from "../core/html.js";
import { icon } from "../core/icons.js";
import { get } from "../core/api.js";
import { initLayout, getCategories } from "../core/layout.js";
import { productCard, skeletons } from "../core/productCard.js";
import { setTitle, setMeta } from "../core/ui.js";
import { naira, debounce } from "../core/format.js";

const cfg = await initLayout();
const app = $("#app");
app.className = "";

const flat = (list, out = []) => { for (const c of list) { out.push(c); flat(c.children || [], out); } return out; };
const allCats = flat(getCategories());
const pathParts = location.pathname.split("/").filter(Boolean);
const FIXED = { type: pathParts[0] === "category" ? "category" : pathParts[0] === "brand" ? "brand" : null, slug: pathParts[1] };

const SORTS = [["featured", "Featured"], ["newest", "Newest arrivals"], ["price_asc", "Price: Low to High"], ["price_desc", "Price: High to Low"], ["bestselling", "Best selling"], ["rating", "Highest rated"]];
let params = new URLSearchParams(location.search);
let facets = null;
let abort;

const catSlug = () => (FIXED.type === "category" ? FIXED.slug : params.get("category"));
const brandSlugs = () => (FIXED.type === "brand" ? [FIXED.slug] : (params.get("brand") || "").split(",").filter(Boolean));
const cat = () => allCats.find((c) => c.slug === catSlug());
const csvGet = (k) => (params.get(k) || "").split(",").filter(Boolean);

function apiQuery() {
  const q = {};
  const c = catSlug(); if (c) q.category = c;
  const b = brandSlugs(); if (b.length) q.brand = b.join(",");
  for (const [k, v] of params) if (k === "q" || k === "minPrice" || k === "maxPrice" || k === "sort" || k === "page" || k === "inStock" || /^(attr_|spec_)/.test(k) || ["bestseller", "onOffer", "newArrival", "featured"].includes(k)) q[k] = v;
  q.limit = 24;
  return q;
}

function setParam(k, v, { resetPage = true } = {}) {
  if (v === "" || v == null) params.delete(k); else params.set(k, v);
  if (resetPage) params.delete("page");
}
function toggleCsv(k, value, on) {
  const cur = FIXED.type === "brand" && k === "brand" ? [] : csvGet(k);
  const next = on ? [...new Set([...cur, value])] : cur.filter((x) => x !== value);
  setParam(k, next.join(","));
}
function pushUrl(replace = false) {
  const base = FIXED.type ? `/${FIXED.type}/${FIXED.slug}` : "/shop";
  const q = params.toString();
  history[replace ? "replaceState" : "pushState"](null, "", base + (q ? "?" + q : ""));
}

function filtersHtml() {
  const f = facets;
  const current = cat();
  const root = current ? (allCats.find((c) => c.children?.some((k) => k.slug === current.slug)) || current) : null;
  const tree = root ? [root, ...(root.children || [])] : getCategories();
  const sel = new Set(brandSlugs());
  const hasFilters = [...params.keys()].some((k) => !["sort", "page", "q"].includes(k) && !(k === "category" && FIXED.type === null && false));
  return html`
  <div class="fgroup fcats"><h3>Categories</h3>
    ${root ? html`<a href="/shop" class="small muted">← All products</a>` : ""}
    ${tree.map((c, i) => html`<a href="/category/${c.slug}" class="${c.slug === catSlug() ? "on" : ""} ${root && i > 0 ? "sub" : ""}">${c.name}</a>`)}</div>
  ${f?.brands?.length > 0 && FIXED.type !== "brand" ? html`<div class="fgroup"><h3>Brand</h3>${f.brands.map((b) => html`<label class="check"><input type="checkbox" data-f="brand" value="${b.slug}" ${sel.has(b.slug) ? "checked" : ""}>${b.name}</label>`)}</div>` : ""}
  ${f?.price?.max > 0 ? html`<div class="fgroup"><h3>Price (₦)</h3><div class="price-inputs"><input class="input" type="number" inputmode="numeric" min="0" placeholder="${Math.floor(f.price.min)}" value="${params.get("minPrice") || ""}" data-price="minPrice" aria-label="Minimum price"><span>–</span><input class="input" type="number" inputmode="numeric" min="0" placeholder="${Math.ceil(f.price.max)}" value="${params.get("maxPrice") || ""}" data-price="maxPrice" aria-label="Maximum price"></div></div>` : ""}
  ${(f?.attrs || []).filter((a) => !a.swatch && a.key !== "colour").map((a) => html`<div class="fgroup"><h3>${a.label}</h3>${a.values.map((v) => html`<label class="check"><input type="checkbox" data-f="attr_${a.key}" value="${v}" ${csvGet("attr_" + a.key).includes(v) ? "checked" : ""}>${v}</label>`)}</div>`)}
  ${(f?.specs || []).map((s) => html`<div class="fgroup"><h3>${s.label}</h3>${s.values.slice(0, 14).map((v) => html`<label class="check"><input type="checkbox" data-f="spec_${s.key}" value="${v}" ${csvGet("spec_" + s.key).includes(v) ? "checked" : ""}>${v}</label>`)}</div>`)}
  <div class="fgroup"><h3>Availability</h3><label class="check"><input type="checkbox" data-flag="inStock" ${params.get("inStock") === "1" ? "checked" : ""}>In stock only</label><label class="check"><input type="checkbox" data-flag="onOffer" ${params.get("onOffer") === "1" ? "checked" : ""}>On offer</label></div>
  ${hasFilters ? html`<button class="btn btn-ghost btn-block" data-clear>Clear all filters</button>` : ""}
  <button class="btn btn-primary btn-block filter-btn" data-close-filters style="margin-top:12px">Show results</button>`;
}

function chipsHtml() {
  const chips = [];
  for (const [k, v] of params) {
    if (["sort", "page", "q"].includes(k) || (k === "category" && !params.get(k))) continue;
    if (k === "category") continue;
    if (k === "minPrice") chips.push([k, null, `From ${naira(v)}`]);
    else if (k === "maxPrice") chips.push([k, null, `Up to ${naira(v)}`]);
    else if (["inStock", "onOffer", "bestseller", "newArrival", "featured"].includes(k)) chips.push([k, null, { inStock: "In stock", onOffer: "On offer", bestseller: "Best sellers", newArrival: "New arrivals", featured: "Featured" }[k]]);
    else if (k === "brand" && FIXED.type !== "brand") v.split(",").forEach((x) => chips.push([k, x, facets?.brands?.find((b) => b.slug === x)?.name || x]));
    else if (/^(attr_|spec_)/.test(k)) v.split(",").forEach((x) => chips.push([k, x, x]));
  }
  return chips.length ? html`<div class="chips" style="margin-bottom:16px">${chips.map(([k, v, label]) => html`<button class="chip" data-chip="${k}" data-val="${v ?? ""}">${label}${icon("close")}</button>`)}</div>` : "";
}

function headHtml(total) {
  const c = cat();
  const brand = FIXED.type === "brand" ? facets?.brands?.[0]?.name || FIXED.slug : null;
  const q = params.get("q");
  const title = q ? `Results for “${q}”` : c ? c.name : brand ? brand : params.get("onOffer") ? "Special offers" : params.get("newArrival") ? "New arrivals" : params.get("bestseller") ? "Best sellers" : "All products";
  setTitle(title, cfg.store.name);
  if (c?.description) setMeta(c.description);
  const crumbs = [["Home", "/"], ["Shop", "/shop"]];
  const parent = c && allCats.find((p) => p.children?.some((k) => k.slug === c.slug));
  if (parent) crumbs.push([parent.name, `/category/${parent.slug}`]);
  return html`<nav class="crumbs" aria-label="Breadcrumb">${crumbs.map(([t, h]) => html`<a href="${h}">${t}</a><span class="sep">/</span>`)}<span aria-current="page">${title}</span></nav>
  <div class="shop-head"><h1>${title}</h1>${c?.description && !q ? html`<p>${c.description}</p>` : ""}</div>`;
}

function paginationHtml(page, pages) {
  if (pages <= 1) return "";
  const link = (p, label, cls = "") => { const u = new URLSearchParams(params); p === 1 ? u.delete("page") : u.set("page", p); const base = FIXED.type ? `/${FIXED.type}/${FIXED.slug}` : "/shop"; return html`<a class="${cls}" href="${base}${u.toString() ? "?" + u : ""}" data-page="${p}" aria-label="Page ${p}">${label}</a>`; };
  const nums = [];
  for (let p = 1; p <= pages; p++) if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p); else if (nums.at(-1) !== "…") nums.push("…");
  return html`<nav class="pagination" aria-label="Pagination">${page > 1 ? link(page - 1, "‹ Prev") : ""}${nums.map((p) => p === "…" ? html`<span>…</span>` : p === page ? html`<span class="cur" aria-current="page">${p}</span>` : link(p, p))}${page < pages ? link(page + 1, "Next ›") : ""}</nav>`;
}

app.innerHTML = html`<div class="wrap" id="shop-root"><div id="shop-head"></div>
  <div class="shop-layout"><aside class="filters" id="filters" aria-label="Filters"></aside>
  <section><div class="toolbar"><div style="display:flex;gap:12px;align-items:center"><button class="btn btn-ghost btn-sm" data-open-filters>${icon("filter")} Filters</button><span class="muted" id="count" aria-live="polite"></span></div>
    <div class="right"><label class="sr-only" for="sort">Sort by</label><select class="select" id="sort">${SORTS.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select></div></div>
    <div id="chips"></div><div class="grid" id="grid">${skeletons(8)}</div><div id="pager"></div></section></div></div>`.toString();
const filterBtn = $("[data-open-filters]"); filterBtn.classList.add("filter-btn");

async function loadProducts() {
  abort?.abort(); abort = new AbortController();
  $("#grid").innerHTML = skeletons(8).toString();
  try {
    const r = await get("/products", apiQuery());
    $("#shop-head").innerHTML = headHtml(r.total).toString();
    $("#count").textContent = `${r.total} product${r.total === 1 ? "" : "s"}`;
    $("#chips").innerHTML = chipsHtml().toString();
    $("#sort").value = params.get("sort") || "featured";
    $("#grid").innerHTML = r.products.length
      ? r.products.map((p) => productCard(p).toString()).join("")
      : html`<div class="empty" style="grid-column:1/-1">${icon("search", "icon-lg")}<h2>No products match</h2><p>Try removing a filter or searching for something else.</p><button class="btn btn-primary" data-clear>Clear filters</button></div>`.toString();
    $("#pager").innerHTML = paginationHtml(r.page, r.pages).toString();
  } catch (e) {
    $("#grid").innerHTML = `<div class="alert alert-error" style="grid-column:1/-1">${esc(e.message)}</div>`;
  }
}
async function loadFacets() {
  try {
    facets = await get("/products/facets", { category: catSlug(), q: params.get("q") });
    renderFilters();
  } catch (e) {
    facets = null;
    $("#filters").innerHTML = html`<div class="alert alert-error">${esc(e.message)}</div>`.toString();
  }
}
function renderFilters() { $("#filters").innerHTML = filtersHtml().toString(); }

function refresh({ facetsToo = false, replace = false } = {}) {
  pushUrl(replace);
  loadProducts();
  facetsToo ? loadFacets() : renderFilters();
  if (!replace) $("#shop-root").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.matches("[data-f]")) { toggleCsv(t.dataset.f, t.value, t.checked); refresh(); }
  else if (t.matches("[data-flag]")) { setParam(t.dataset.flag, t.checked ? "1" : ""); refresh(); }
  else if (t.matches("#sort")) { setParam("sort", t.value === "featured" ? "" : t.value); refresh(); }
});
const priceChange = debounce((t) => { setParam(t.dataset.price, t.value ? Math.max(0, Number(t.value)) : ""); refresh({ replace: true }); }, 600);
document.addEventListener("input", (e) => { if (e.target.matches("[data-price]")) priceChange(e.target); });
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest("[data-clear]")) { params = new URLSearchParams(params.get("q") ? { q: params.get("q") } : {}); if (FIXED.type === null) params.delete("category"); refresh(); $("#filters").classList.remove("open"); }
  const chip = t.closest("[data-chip]");
  if (chip) { const k = chip.dataset.chip, v = chip.dataset.val; v ? toggleCsv(k, v, false) : setParam(k, ""); refresh(); }
  if (t.closest("[data-open-filters]")) $("#filters").classList.add("open"), $("[data-backdrop]").classList.add("open");
  if (t.closest("[data-close-filters]")) { $("#filters").classList.remove("open"); $("[data-backdrop]").classList.remove("open"); }
  if (t.matches("[data-backdrop]")) $("#filters").classList.remove("open");
  const pg = t.closest("[data-page]");
  if (pg) { e.preventDefault(); setParam("page", pg.dataset.page, { resetPage: false }); refresh(); }
  const catLink = t.closest(".fcats a");
  if (catLink && catLink.getAttribute("href") === "/shop") { /* normal navigation */ }
});
window.addEventListener("popstate", () => { params = new URLSearchParams(location.search); loadProducts(); loadFacets(); });
// search box on this page updates results without a full reload
$('.search form')?.addEventListener("submit", (e) => { e.preventDefault(); const v = $('.search input').value.trim(); params = new URLSearchParams(v ? { q: v } : {}); if (FIXED.type) { location.href = `/shop${v ? "?q=" + encodeURIComponent(v) : ""}`; return; } refresh({ facetsToo: true }); });

await loadFacets();
loadProducts();
