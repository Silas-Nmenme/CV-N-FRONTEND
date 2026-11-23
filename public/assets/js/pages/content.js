import { html, $, raw } from "../core/html.js";
import { get } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { setTitle, markdown } from "../core/ui.js";

const cfg = await initLayout();
const app = $("#app"); app.className = "";
const slug = location.pathname.slice(1);
const MAP = { about: "about", faq: "faq", "privacy-policy": "privacy-policy", terms: "terms", "shipping-policy": "shipping-policy", "returns-policy": "returns-policy" };
try {
  const { page } = await get(`/pages/${MAP[slug] || slug}`);
  setTitle(page.title, cfg.store.name);
  let body;
  if (slug === "faq") {
    // "## Question" + answer becomes an accordion
    const parts = page.body.split(/^##\s+/m).slice(1);
    body = html`${parts.map((p) => { const [q, ...rest] = p.split("\n"); return html`<details class="faq-item"><summary>${q}</summary><div>${markdown(rest.join("\n"))}</div></details>`; })}`;
  } else body = markdown(page.body);
  app.innerHTML = html`<div class="wrap" style="padding-top:28px"><article class="prose">${slug === "faq" ? html`<h1>${page.title}</h1>` : ""}${body}</article></div>`.toString();
} catch (e) {
  app.innerHTML = html`<div class="wrap empty"><h1>Page not found</h1><a class="btn btn-primary" href="/">Go home</a></div>`.toString();
}
