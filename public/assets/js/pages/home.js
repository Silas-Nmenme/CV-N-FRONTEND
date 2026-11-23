import { html, $, $$ } from "../core/html.js";
import { icon } from "../core/icons.js";
import { get, assetUrl } from "../core/api.js";
import { initLayout, getCategories, waLink } from "../core/layout.js";
import { productCard, skeletons } from "../core/productCard.js";
import { stars, setTitle } from "../core/ui.js";

const cfg = await initLayout();
setTitle("", cfg.store.name + " | " + cfg.store.tagline);
const app = $("#app");
app.className = "";

/* A product rail that only fetches when scrolled near, so the first paint stays fast. */
function section({ id, title, sub, query, more, cols = 4, tabs }) {
  return html`<section class="section" id="${id}" data-lazy><div class="wrap"><div class="section-head"><div><h2>${title}</h2>${sub ? html`<p>${sub}</p>` : ""}</div>${more ? html`<a class="more" href="${more}" data-more>View all</a>` : ""}</div>
    ${tabs ? html`<div class="tabs" role="tablist" style="margin-bottom:20px">${tabs.map((t, i) => html`<button class="tab" role="tab" aria-selected="${i === 0}" data-tab="${i}">${t.label}</button>`)}</div>` : ""}
    <div class="rail" data-rail>${skeletons(cols)}</div></div></section>`;
}

const sections = [
  { id: "best-phones", title: "Best-selling smartphones", sub: "What Nigerians are buying right now", query: { category: "phones", bestseller: 1, sort: "bestselling", limit: 8 }, more: "/shop?category=phones&bestseller=1" },
  { id: "iphones", title: "Latest iPhones", sub: "iPhone 11 to iPhone 17, brand new and UK used", query: { category: "phones", brand: "apple", sort: "newest", limit: 8 }, more: "/shop?category=phones&brand=apple" },
  { id: "samsung", title: "Samsung smartphones", sub: "Galaxy S, Z, A and M series", query: { category: "phones", brand: "samsung", sort: "featured", limit: 8 }, more: "/shop?category=phones&brand=samsung" },
  { id: "laptops", title: "Featured laptops", sub: "Business, school and gaming laptops", query: { category: "laptops", featured: 1, limit: 8 }, more: "/category/laptops" },
  { id: "laptop-brands", title: "HP, Dell, Lenovo and MacBook", sub: "Pick your brand", tabs: [{ label: "HP", query: { category: "laptops", brand: "hp", limit: 8 }, more: "/shop?category=laptops&brand=hp" }, { label: "Dell", query: { category: "laptops", brand: "dell", limit: 8 }, more: "/shop?category=laptops&brand=dell" }, { label: "Lenovo", query: { category: "laptops", brand: "lenovo", limit: 8 }, more: "/shop?category=laptops&brand=lenovo" }, { label: "MacBook", query: { category: "macbooks", limit: 8 }, more: "/category/macbooks" }] },
  { id: "tablets", title: "iPads and Samsung tablets", sub: "For work, study and entertainment", query: { category: "tablets", sort: "featured", limit: 8 }, more: "/category/tablets" },
  { id: "kids", title: "Children's tablets", sub: "Learning and entertainment tablets with parental controls", query: { category: "kids-tablets", limit: 8 }, more: "/category/kids-tablets" },
  { id: "chargers", title: "Chargers and accessories", sub: "Chargers, adapters and cables for every gadget", query: { category: "chargers-and-accessories", sort: "bestselling", limit: 8 }, more: "/category/chargers-and-accessories" },
  { id: "new", title: "New arrivals", sub: "Just landed in the store", query: { newArrival: 1, sort: "newest", limit: 8 }, more: "/shop?newArrival=1" },
  { id: "offers", title: "Special offers", sub: "Reduced prices while stock lasts", query: { onOffer: 1, limit: 8 }, more: "/shop?onOffer=1" },
];

let content;
try {
  content = await get("/content/home");
} catch (e) {
  app.innerHTML = html`<div class="wrap"><div class="alert alert-error">Couldn't load homepage content: ${e.message}</div></div>`.toString();
  throw e;
}
const slides = content.hero;
const trust = cfg.trust || [];
const TRUST_ICONS = ["lock", "truck", "shield", "whatsapp"];
const tiles = getCategories().flatMap((category) => [category, ...(category.children || [])]).filter((category) => category.showInNav);

app.innerHTML = html`
${slides.length || trust.length ? html`<div class="wrap hero" aria-roles="region" aria-label="Featured">
  <div id="hero-stage"></div>
  ${slides.length > 1 ? html`<div class="hero-dots">${slides.map((_, i) => html`<button aria-label="Show slide ${i + 1}" aria-current="${i === 0}" data-slide="${i}"></button>`)}</div>` : ""}
  ${trust.length ? html`<div class="trust">${trust.slice(0, 4).map((t, i) => html`<div class="trust-item">${icon(TRUST_ICONS[i % 4])}<div><b>${t.title}</b><span>${t.text}</span></div></div>`)}</div>` : ""}
</div>` : ""}
<section class="section"><div class="wrap"><div class="tiles" id="tiles">${tiles.map((category) => html`<a class="tile" href="/category/${category.slug}" data-tile="${category.slug}"><img alt="" width="96" height="96"><span>Shop ${category.name}</span></a>`)}</div></div></section>
${sections.slice(0, 1).map(section)}
${sections.slice(1, 4).map(section)}
${content.promo.length ? html`<section class="section"><div class="wrap promos">${content.promo.slice(0, 2).map((p) => html`<div class="promo t-${p.theme}"><h3>${p.title}</h3><p>${p.subtitle}</p><a class="btn ${p.theme === "volt" || p.theme === "light" ? "btn-dark" : "btn-amber"}" href="${p.ctaLink}">${p.ctaText}</a>${p.image ? html`<img src="${assetUrl(p.image)}" alt="" loading="lazy">` : ""}</div>`)}</div></section>` : ""}
${sections.slice(4, 8).map(section)}
<section class="section"><div class="wrap"><div class="section-head"><h2>Shop by brand</h2></div><div class="brand-strip" id="brands"></div></div></section>
${sections.slice(8).map(section)}
<section class="section" id="testimonials" ${content.testimonials.length ? "" : "hidden"}><div class="wrap"><div class="section-head"><div><h2>What customers say</h2></div></div>
  <div class="testis">${content.testimonials.slice(0, 3).map((t) => html`<figure class="testi" style="margin:0">${stars(t.rating || 5)}<p>“${t.text}”</p><footer><b>${t.name}</b>${t.location || ""}${t.sample ? html`<div class="sample-note">Sample testimonial</div>` : ""}</footer></figure>`)}</div></div></section>`.toString();

/* hero */
const stage = $("#hero-stage");
let cur = 0, timer;
const showSlide = (i, animate = true) => {
  cur = i;
  const s = slides[i];
  const art = s.image ? assetUrl(s.image) : "/assets/img/hero-devices.svg";
  stage.innerHTML = html`<div class="hero-slide t-${s.theme} ${animate ? "reveal" : ""}"><div class="hero-copy"><h1>${s.title}</h1><p>${s.subtitle}</p><div class="hero-cta"><a class="btn btn-lg ${s.theme === "volt" || s.theme === "light" ? "btn-dark" : "btn-amber"}" href="${s.ctaLink}">${s.ctaText}</a>${waLink(cfg) ? html`<a class="btn btn-lg ${s.theme === "light" || s.theme === "volt" ? "btn-ghost" : ""}" style="${s.theme === "light" || s.theme === "volt" ? "" : "border-color:rgba(255,255,255,.5);color:#fff"}" href="${waLink(cfg, "Hello, I'd like help choosing a gadget.")}" target="_blank" rel="noopener">${icon("whatsapp")} Ask on WhatsApp</a>` : ""}</div></div><div class="hero-art"><img src="${art}" alt="" width="560" height="380"></div></div>`.toString();
  $$(".hero-dots button").forEach((b, j) => b.setAttribute("aria-current", j === i));
};
if (slides.length) showSlide(0);
if (slides.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const start = () => (timer = setInterval(() => showSlide((cur + 1) % slides.length), 6500));
  start();
  $(".hero").addEventListener("mouseenter", () => clearInterval(timer));
  $(".hero").addEventListener("mouseleave", start);
}
$$(".hero-dots button").forEach((b) => b.addEventListener("click", () => { clearInterval(timer); showSlide(Number(b.dataset.slide)); }));

/* category tile images come from a featured product in each category */
$$("[data-tile]").forEach(async (a) => {
  try {
    const r = await get("/products", { category: a.dataset.tile, limit: 1, sort: "featured" });
    if (r.products[0]?.image) a.querySelector("img").src = assetUrl(r.products[0].image);
  } catch {
    a.querySelector("img").alt = "Category image unavailable";
  }
});

/* brands */
get("/brands").then((r) => { $("#brands").innerHTML = html`${r.brands.filter((b) => b.slug !== "generic").map((b) => html`<a class="brand-chip" href="/shop?brand=${b.slug}">${b.name}</a>`)}`.toString(); }).catch((e) => {
  $("#brands").innerHTML = html`<div class="alert alert-error">${e.message}</div>`.toString();
});

/* lazy rails */
async function fill(sec, query, more) {
  const rail = $("[data-rail]", sec);
  try {
    const r = await get("/products", query);
    if (!r.products.length) { sec.hidden = true; return; }
    rail.innerHTML = r.products.map((p) => productCard(p).toString()).join("");
    const m = $("[data-more]", sec);
    if (m && more) m.href = more;
  } catch (e) { rail.innerHTML = html`<div class="alert alert-error">${e.message}</div>`.toString(); }
}
const all = [...sections];
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    io.unobserve(e.target);
    const def = all.find((s) => s.id === e.target.id);
    if (def.tabs) {
      const tabs = $$("[data-tab]", e.target);
      const load = (i) => { tabs.forEach((t, j) => t.setAttribute("aria-selected", j === i)); $("[data-rail]", e.target).innerHTML = skeletons(4).toString(); fill(e.target, def.tabs[i].query, def.tabs[i].more); };
      tabs.forEach((t, i) => t.addEventListener("click", () => load(i)));
      load(0);
      $("[data-more]", e.target)?.remove();
    } else fill(e.target, def.query, def.more);
  }
}, { rootMargin: "400px" });
$$("[data-lazy]").forEach((s) => io.observe(s));
