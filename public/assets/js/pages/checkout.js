import { html, $, $$ } from "../core/html.js";
import { icon } from "../core/icons.js";
import { get, post, assetUrl } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { setTitle, toast, showFieldErrors, formAlert, clearAlert, clearFieldErrors, withLoading } from "../core/ui.js";
import { naira } from "../core/format.js";
import { Cart, storage, session, loadSession, OrderTokens } from "../core/state.js";

const cfg = await initLayout();
setTitle("Checkout", cfg.store.name);
await loadSession();
const app = $("#app");
app.className = "";
const pref = () => storage.get("cvg_checkout", {});
const savePref = (p) => storage.set("cvg_checkout", { ...pref(), ...p });

if (!Cart.count()) { location.replace("/cart"); await new Promise(() => {}); }

const P = pref();
let q = null;
let delivery = [];
let method = P.method || "";
let payment = cfg.payments.methods[0] || "";
let saved = [];
if (session.user) { try { saved = (await get("/account/addresses")).addresses; } catch { /* ignore */ } }
const defAddr = saved.find((a) => a.isDefault) || saved[0];
const u = session.user;
const form0 = { fullName: u?.name || "", email: u?.email || "", phone: (u?.phone || "").replace("+234", "0"), state: P.state || defAddr?.state || "", city: defAddr?.city || "", address: defAddr?.address || "", notes: "" };

const PAY_META = { paystack: ["Pay with card, bank or USSD", "Secure payment powered by Paystack", "card"], flutterwave: ["Pay with card, bank or mobile money", "Secure payment powered by Flutterwave", "card"], bank_transfer: ["Pay by bank transfer", "Transfer to our account. We confirm your payment manually.", "bank"] };

app.innerHTML = html`<div class="wrap" style="padding-top:24px"><h1>Checkout</h1>
${!cfg.payments.methods.length ? html`<div class="alert alert-error">Online payment is not set up yet. Please contact us on WhatsApp to place your order.</div>` : ""}
<div class="checkout-layout"><form id="co-form" novalidate>
  ${u ? "" : html`<div class="alert alert-info">Have an account? <a href="/login?next=/checkout">Sign in</a> for faster checkout. Or continue as a guest.</div>`}
  <div class="panel co-step"><h2><i>1</i> Contact</h2><div class="form-grid">
    <div class="field full"><label for="fullName">Full name</label><input class="input" id="fullName" name="fullName" autocomplete="name" value="${form0.fullName}"></div>
    <div class="field"><label for="email">Email address</label><input class="input" id="email" name="email" type="email" autocomplete="email" value="${form0.email}"><div class="hint">Your receipt and order updates go here.</div></div>
    <div class="field"><label for="phone">Phone number</label><input class="input" id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="0803 123 4567" value="${form0.phone}"><div class="hint">We call or WhatsApp this number for delivery.</div></div></div></div>
  <div class="panel co-step"><h2><i>2</i> Delivery</h2>
    ${saved.length ? html`<div class="field"><label for="saved">Use a saved address</label><select class="select" id="saved"><option value="">Enter a new address</option>${saved.map((a) => html`<option value="${a._id}" ${defAddr?._id === a._id ? "selected" : ""}>${a.label} – ${a.address}, ${a.city}</option>`)}</select></div>` : ""}
    <div class="form-grid"><div class="field"><label for="state">State</label><select class="select" id="state" name="state"><option value="">Select your state</option>${cfg.states.map((s) => html`<option ${form0.state === s ? "selected" : ""}>${s}</option>`)}</select></div>
    <div class="field"><label for="city">City / town</label><input class="input" id="city" name="city" autocomplete="address-level2" value="${form0.city}"></div>
    <div class="field full"><label for="address">Delivery address</label><textarea class="textarea" id="address" name="address" autocomplete="street-address" style="min-height:76px" placeholder="House number, street, landmark">${form0.address}</textarea></div>
    <div class="field full"><label for="notes">Delivery instructions (optional)</label><input class="input" id="notes" name="notes" maxlength="500" placeholder="e.g. call before arriving, gate colour"></div></div>
    <div id="methods" aria-live="polite"><p class="muted small">Choose your state to see delivery options.</p></div><div class="field-error" id="method-error" style="display:none"></div></div>
  <div class="panel co-step"><h2><i>3</i> Payment</h2>
    ${cfg.payments.methods.map((m) => html`<label class="radio-card"><input type="radio" name="paymentMethod" value="${m}" ${m === payment ? "checked" : ""}><div><b>${PAY_META[m][0]}</b><div class="sub">${PAY_META[m][1]}</div></div>${icon(PAY_META[m][2] === "bank" ? "bank" : "card")}</label>`)}
    <div id="bank-note"></div></div>
  <div class="no-print"><button class="btn btn-primary btn-lg btn-block" type="submit" id="place" ${cfg.payments.methods.length ? "" : "disabled"}>Place order</button>
  <div class="secure-note">${icon("lock")} Your payment is processed securely. We never see your card details.</div></div></form>
  <aside class="panel summary" id="summary"><span class="spinner"></span></aside></div></div>`.toString();

const form = $("#co-form");

async function refresh() {
  const state = form.state.value;
  savePref({ state, method });
  try {
    q = await post("/cart/quote", { items: Cart.items(), couponCode: pref().coupon || undefined, state: state || undefined, shippingMethod: method || undefined, email: form.email.value.trim() || undefined });
  } catch (e) { return formAlert(form, e.message); }
  delivery = q.deliveryOptions || [];
  if (!delivery.find((d) => d.code === method)) { method = delivery.length === 1 ? delivery[0].code : ""; if (method) { q = await post("/cart/quote", { items: Cart.items(), couponCode: pref().coupon || undefined, state, shippingMethod: method, email: form.email.value.trim() || undefined }); } }
  drawMethods(); drawSummary();
}

function drawMethods() {
  const box = $("#methods");
  if (!form.state.value) { box.innerHTML = `<p class="muted small">Choose your state to see delivery options.</p>`; return; }
  if (!delivery.length) { box.innerHTML = html`<div class="alert alert-warn">We don't deliver to ${form.state.value} online yet. <a href="/contact">Contact us</a> and we'll arrange it.</div>`.toString(); return; }
  box.innerHTML = html`<div class="label" style="margin-top:8px">Delivery method</div>${delivery.map((d) => html`<label class="radio-card"><input type="radio" name="method" value="${d.code}" ${d.code === method ? "checked" : ""}><div><b>${d.name}</b><div class="sub">${d.pickup ? d.eta : d.eta ? `Arrives in ${d.eta}` : ""}${d.free ? " · Free for this order" : d.freeOver ? ` · Free over ${naira(d.freeOver)}` : ""}</div></div><span class="amt">${d.fee === 0 ? "Free" : naira(d.fee)}</span></label>`)}`.toString();
}

function drawSummary() {
  $("#summary").innerHTML = html`<h2 class="panel-title">Order summary</h2>
  ${q.issues.map((i) => html`<div class="alert alert-warn">${i.message} <a href="/cart">Review cart</a></div>`)}
  ${q.lines.map((l) => html`<div class="sum-item"><img src="${assetUrl(l.image)}" alt="" width="56" height="56"><div><b>${l.name}</b><div class="q">${Object.values(l.attrs).join(" · ")} × ${l.quantity}</div></div><span>${naira(l.lineTotal)}</span></div>`)}
  <form class="coupon-form" id="coupon-form"><input class="input" name="code" placeholder="Coupon code" aria-label="Coupon code" value="${q.coupon?.code || ""}" ${q.coupon ? "readonly" : ""}><button class="btn ${q.coupon ? "btn-ghost" : "btn-dark"}" type="submit">${q.coupon ? "Remove" : "Apply"}</button></form>
  ${q.couponError ? html`<div class="alert alert-error">${q.couponError}</div>` : ""}
  <div class="sum-row"><span>Subtotal</span><span>${naira(q.subtotal)}</span></div>
  ${q.discount ? html`<div class="sum-row"><span>Discount (${q.coupon.code})</span><span class="disc">-${naira(q.discount)}</span></div>` : ""}
  <div class="sum-row"><span>Delivery</span><span>${q.shipping ? (q.shipping.fee ? naira(q.shipping.fee) : "Free") : html`<span class="muted small">Select method</span>`}</span></div>
  <div class="sum-row total"><span>Total</span><span>${naira(q.total)}</span></div>
  <p class="small muted center" style="margin:8px 0 0">Prices in Nigerian Naira (₦)</p>`.toString();
}

function drawBankNote() {
  const box = $("#bank-note");
  if (payment === "bank_transfer" && cfg.payments.bank) { const b = cfg.payments.bank; box.innerHTML = html`<div class="bank-box" style="margin-top:6px"><dl><dt>Bank</dt><dd>${b.bankName}</dd><dt>Account name</dt><dd>${b.accountName}</dd><dt>Account number</dt><dd>${b.accountNumber}</dd></dl><span class="small">${b.instructions}</span></div>`.toString(); }
  else box.innerHTML = "";
}

form.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.name === "state") { method = ""; await refresh(); }
  else if (t.name === "method") { method = t.value; await refresh(); }
  else if (t.name === "paymentMethod") { payment = t.value; drawBankNote(); }
  else if (t.id === "saved") {
    const a = saved.find((x) => x._id === t.value);
    if (a) { form.state.value = a.state; form.city.value = a.city; form.address.value = a.address; form.fullName.value ||= a.fullName; method = ""; await refresh(); }
  }
  else if (t.name === "email") { refresh(); }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "coupon-form") return;
  e.preventDefault();
  const f = e.target;
  if (q.coupon) savePref({ coupon: "" }); else { const code = f.code.value.trim(); if (!code) return toast("Enter a coupon code", "err"); savePref({ coupon: code }); }
  await withLoading(f.querySelector("button"), refresh);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert(form); clearFieldErrors(form);
  $("#method-error").style.display = "none";
  const errs = {};
  const v = (n) => form[n].value.trim();
  if (v("fullName").length < 2) errs.fullName = "Enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(v("email"))) errs.email = "Enter a valid email address.";
  if (!/^(?:\+?234|0)[789][01]\d{8}$/.test(v("phone").replace(/[\s()-]/g, ""))) errs.phone = "Enter a valid Nigerian phone number, e.g. 0803 123 4567.";
  if (!v("state")) errs.state = "Choose your state.";
  if (v("city").length < 2) errs.city = "Enter your city or town.";
  if (v("address").length < 5) errs.address = "Enter your full delivery address.";
  if (Object.keys(errs).length) { showFieldErrors(form, errs); return; }
  if (!method) { const m = $("#method-error"); m.textContent = "Choose a delivery method."; m.style.display = "block"; m.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
  if (!payment) return formAlert(form, "Choose a payment method.");

  await withLoading($("#place"), async () => {
    try {
      const r = await post("/orders", {
        items: Cart.items(),
        customer: { fullName: v("fullName"), email: v("email"), phone: v("phone") },
        shipping: { state: v("state"), city: v("city"), address: v("address"), notes: v("notes"), method },
        paymentMethod: payment, couponCode: pref().coupon || undefined,
      });
      OrderTokens.save(r.order.reference, r.accessToken);
      savePref({ coupon: "" });
      const ref = r.order.reference;
      if (payment === "bank_transfer") { Cart.clear(); location.href = `/order?ref=${encodeURIComponent(ref)}&t=${r.accessToken}&new=1`; return; }
      const init = await post("/payments/initialize", { orderReference: ref, accessToken: r.accessToken, provider: payment });
      Cart.clear();
      location.href = init.url;
    } catch (err) {
      if (err.fields?.issues) { formAlert(form, err.message); refresh(); }
      else if (!showFieldErrors(form, err.fields)) formAlert(form, err.message);
      if (err.status === 409) refresh();
    }
  });
  // If we reach here the redirect failed; the button is re-enabled by withLoading.
});

drawBankNote();
await refresh();
