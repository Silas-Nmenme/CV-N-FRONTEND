import { html, $, esc } from "../core/html.js";
import { icon } from "../core/icons.js";
import { get } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { productCard, skeletons } from "../core/productCard.js";
import { setTitle } from "../core/ui.js";
import { Wish, on, loadSession } from "../core/state.js";

const cfg = await initLayout();
setTitle("Wishlist", cfg.store.name);
const app = $("#app"); app.className = "";
await loadSession();
app.innerHTML = html`<div class="wrap" style="padding-top:24px"><h1>Your wishlist</h1><div id="list" class="grid">${skeletons(4)}</div></div>`.toString();
async function draw() {
  const ids = Wish.ids();
  const list = $("#list");
  if (!ids.length) { list.className = ""; list.innerHTML = html`<div class="empty">${icon("heart", "icon-lg")}<h2>Nothing saved yet</h2><p>Tap the heart on any product to save it here.</p><a class="btn btn-primary" href="/shop">Browse products</a></div>`.toString(); return; }
  try {
    const r = await get("/products/by-ids", { ids: ids.join(",") });
    // drop saved items that no longer exist
    list.className = "grid";
    list.innerHTML = r.products.length ? r.products.map((p) => productCard(p).toString()).join("") : "";
    if (!r.products.length) { list.className = ""; list.innerHTML = `<div class="empty"><h2>Those items are no longer available</h2></div>`; }
  } catch (e) { list.innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`; }
}
await draw();
// when an item is un-hearted here, remove its card
on("wish", () => { const keep = new Set(Wish.ids()); document.querySelectorAll("#list .card").forEach((c) => { if (!keep.has(c.dataset.id)) c.remove(); }); if (!Wish.count()) draw(); });
