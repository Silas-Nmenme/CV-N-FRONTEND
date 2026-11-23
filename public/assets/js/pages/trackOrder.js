import { html, $ } from "../core/html.js";
import { post } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { setTitle, showFieldErrors, formAlert, clearAlert, clearFieldErrors, withLoading } from "../core/ui.js";
import { timeline, pill, itemsAndTotals, detailsBlock } from "../core/orderView.js";

const cfg = await initLayout();
setTitle("Track your order", cfg.store.name);
const app = $("#app"); app.className = "";
const p = new URLSearchParams(location.search);
app.innerHTML = html`<div class="wrap" style="padding-top:24px;max-width:900px"><h1>Track your order</h1><p class="muted">Enter your order reference and the email or phone number you used at checkout.</p>
<div class="panel"><form id="f" novalidate><div class="form-grid"><div class="field"><label for="reference">Order reference</label><input class="input" id="reference" name="reference" placeholder="CVG-240101-ABC123" value="${p.get("ref") || ""}" autocapitalize="characters"></div><div class="field"><label for="contact">Email or phone number</label><input class="input" id="contact" name="contact" autocomplete="email"></div></div><button class="btn btn-primary" type="submit">Track order</button></form></div><div id="result" style="margin-top:20px"></div></div>`.toString();
$("#f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target; clearAlert(f); clearFieldErrors(f);
  const errs = {};
  if (f.reference.value.trim().length < 6) errs.reference = "Enter your order reference.";
  if (f.contact.value.trim().length < 3) errs.contact = "Enter the email or phone number on the order.";
  if (Object.keys(errs).length) return showFieldErrors(f, errs);
  await withLoading(f.querySelector("button"), async () => {
    try {
      const { order: o } = await post("/orders/track", { reference: f.reference.value.trim(), contact: f.contact.value.trim() });
      $("#result").innerHTML = html`<div class="cart-layout"><div style="display:grid;gap:20px"><div class="panel"><h2 class="panel-title">${o.reference} ${pill(o.status)}</h2>${timeline(o)}</div><div class="panel"><h2 class="panel-title">Details</h2>${detailsBlock(o)}</div></div><aside class="panel summary"><h2 class="panel-title">Items</h2>${itemsAndTotals(o)}</aside></div>`.toString();
    } catch (err) { $("#result").innerHTML = ""; if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); }
  });
});
