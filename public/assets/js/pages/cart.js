import { html, $, $$, esc } from "../core/html.js";
import { icon } from "../core/icons.js";
import { post, assetUrl } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { setTitle, toast, withLoading } from "../core/ui.js";
import { naira } from "../core/format.js";
import { Cart, storage } from "../core/state.js";

const cfg = await initLayout();
setTitle("Your cart", cfg.store.name);
const app = $("#app");
app.className = "";
const pref = () => storage.get("cvg_checkout", {});
const savePref = (p) => storage.set("cvg_checkout", { ...pref(), ...p });
let q = null;

async function load() {
  const items = Cart.items();
  if (!items.length) return draw(null);
  const p = pref();
  try {
    q = await post("/cart/quote", { items, couponCode: p.coupon || undefined, state: p.state || undefined, shippingMethod: p.method || undefined });
    if (q.couponError) { savePref({ coupon: "" }); }
    // reconcile local cart with live availability
    const live = q.lines.map((l) => ({ productId: l.productId, sku: l.sku, quantity: l.quantity }));
    if (JSON.stringify(live) !== JSON.stringify(items)) Cart.replace(live);
    draw(q);
  } catch (e) { app.innerHTML = `<div class="wrap"><div class="alert alert-error" style="margin-top:24px">${esc(e.message)}</div></div>`; }
}

function draw(q) {
  if (!q || !q.lines.length) {
    app.innerHTML = html`<div class="wrap">${q?.issues?.map((i) => html`<div class="alert alert-warn" style="margin-top:16px">${i.message}</div>`)}<div class="empty">${icon("cart", "icon-lg")}<h2>Your cart is empty</h2><p>Find a phone, laptop, tablet or charger you love.</p><a class="btn btn-primary btn-lg" href="/shop">Continue shopping</a></div></div>`.toString();
    return;
  }
  const p = pref();
  const cheapest = q.deliveryOptions?.length ? q.deliveryOptions.reduce((a, b) => (b.fee < a.fee ? b : a)) : null;
  app.innerHTML = html`<div class="wrap" style="padding-top:24px"><h1>Shopping cart <span class="muted" style="font-size:1rem;font-weight:500">(${q.itemCount} item${q.itemCount === 1 ? "" : "s"})</span></h1>
  ${q.issues.map((i) => html`<div class="alert alert-warn">${i.message}</div>`)}
  <div class="cart-layout"><div class="panel" id="lines">${q.lines.map((l) => html`<div class="cart-line"><a href="/p/${l.slug}"><img src="${assetUrl(l.image)}" alt="" width="110" height="110"></a>
    <div><a class="name" href="/p/${l.slug}">${l.name}</a><div class="opts">${Object.values(l.attrs).join(" · ")}</div><div class="actions"><div class="qty sm"><button data-q="-1" data-pid="${l.productId}" data-sku="${l.sku}" aria-label="Decrease quantity for ${l.name}">${icon("minus")}</button><input value="${l.quantity}" readonly aria-label="Quantity"><button data-q="1" data-pid="${l.productId}" data-sku="${l.sku}" aria-label="Increase quantity for ${l.name}" ${l.quantity >= Math.min(10, l.stock) ? "disabled" : ""}>${icon("plus")}</button></div><button class="link-btn small" style="color:var(--red)" data-rm data-pid="${l.productId}" data-sku="${l.sku}">${icon("trash")} Remove</button></div></div>
    <div class="line-total">${naira(l.lineTotal)}<div class="small muted" style="font-weight:400;font-family:var(--font-body)">${naira(l.unitPrice)} each</div></div></div>`)}
    <div style="padding-top:18px"><a href="/shop">← Continue shopping</a></div></div>
  <aside class="panel summary"><h2 class="panel-title">Order summary</h2>
    <form class="coupon-form" id="coupon-form"><input class="input" name="code" placeholder="Coupon code" aria-label="Coupon code" value="${q.coupon?.code || ""}" ${q.coupon ? "readonly" : ""}><button class="btn ${q.coupon ? "btn-ghost" : "btn-dark"}" type="submit">${q.coupon ? "Remove" : "Apply"}</button></form>
    ${q.couponError ? html`<div class="alert alert-error">${q.couponError}</div>` : ""}
    <div class="sum-row"><span>Subtotal</span><span>${naira(q.subtotal)}</span></div>
    ${q.discount ? html`<div class="sum-row"><span>Discount (${q.coupon.code})</span><span class="disc">-${naira(q.discount)}</span></div>` : ""}
    <div class="field" style="margin:12px 0 4px"><label for="state">Estimate delivery to</label><select class="select" id="state"><option value="">Select your state</option>${cfg.states.map((s) => html`<option ${p.state === s ? "selected" : ""}>${s}</option>`)}</select></div>
    <div class="sum-row"><span>Delivery</span><span>${!p.state ? html`<span class="muted small">Choose a state</span>` : q.deliveryUnavailable ? html`<span class="muted small">Not available</span>` : cheapest ? (cheapest.fee ? `from ${naira(cheapest.fee)}` : "Free") : ""}</span></div>
    ${q.deliveryUnavailable ? html`<div class="alert alert-warn small">We don't deliver to ${p.state} online yet. Contact us on WhatsApp to arrange delivery.</div>` : ""}
    <div class="sum-row total"><span>Total</span><span>${naira(q.subtotal - q.discount + (cheapest && p.state ? cheapest.fee : 0))}</span></div>
    <p class="small muted">${p.state && cheapest ? "Final delivery fee depends on the method you choose at checkout." : "Delivery is calculated at checkout."}</p>
    <a class="btn btn-primary btn-lg btn-block" href="/checkout">Proceed to checkout</a>
    <div class="secure-note">${icon("lock")} Secure checkout</div></aside></div></div>`.toString();
}

document.addEventListener("click", (e) => {
  const qb = e.target.closest("[data-q]");
  if (qb) { const l = Cart.items().find((i) => i.productId === qb.dataset.pid && i.sku === qb.dataset.sku); Cart.setQty(qb.dataset.pid, qb.dataset.sku, (l?.quantity || 1) + Number(qb.dataset.q)); load(); }
  const rm = e.target.closest("[data-rm]");
  if (rm) { Cart.remove(rm.dataset.pid, rm.dataset.sku); toast("Removed from cart"); load(); }
});
document.addEventListener("change", (e) => { if (e.target.id === "state") { savePref({ state: e.target.value, method: "" }); load(); } });
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "coupon-form") return;
  e.preventDefault();
  const f = e.target;
  if (q?.coupon) { savePref({ coupon: "" }); return load(); }
  const code = f.code.value.trim();
  if (!code) return toast("Enter a coupon code", "err");
  savePref({ coupon: code });
  await withLoading(f.querySelector("button"), load);
});
await load();
