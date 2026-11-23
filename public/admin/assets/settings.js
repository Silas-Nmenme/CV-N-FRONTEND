import { html, $, $$, icon, api, field, repeater, bindRepeaters, readRepeater, readForm } from "./lib.js";
import { register } from "./admin.js";
import { toast, withLoading, formAlert, clearAlert, showFieldErrors, clearFieldErrors } from "/assets/js/core/ui.js";

register("settings", async (view) => {
  const { settings: s, credentials: c, webhookUrls } = await api("/settings");
  const TRUST = [{ k: "title", label: "Title", w: "180px" }, { k: "text", label: "Text", w: "340px" }];
  const tr = repeater("trust", TRUST, s.trust, { addLabel: "Add item" });
  const st = s.store, pay = s.payments;
  const status = (ok, label) => html`<span class="tag ${ok ? "tag-ok" : "tag-low"}">${ok ? "Configured" : "Not configured"}</span> ${label}`;
  view.innerHTML = html`<div class="a-head"><h1>Settings</h1></div>
  <form class="a-form" id="sform" novalidate>
    <div class="card-a"><h2>Store details</h2><p class="muted small" style="margin-top:-8px">These appear in the website header, footer, contact page, emails and receipts. Nothing is shown publicly until you fill it in.</p><div class="form-grid">
      ${field("Store name", "store.name", st.name)}${field("Tagline", "store.tagline", st.tagline)}
      ${field("Support email", "store.email", st.email, { type: "email", hint: "Customer enquiries and new-order alerts are sent here." })}${field("Phone number", "store.phone", st.phone, { ph: "0803 123 4567" })}
      ${field("WhatsApp number", "store.whatsapp", st.whatsapp, { ph: "0803 123 4567", hint: "Powers the WhatsApp buttons. Nigerian numbers are converted to international format automatically." })}${field("Opening hours", "store.openingHours", st.openingHours, { ph: "Mon–Sat, 9am–6pm" })}
      ${field("Store address", "store.address", st.address, { type: "textarea", full: true, rows: 2 })}${field("Map link (Google Maps URL)", "store.mapUrl", st.mapUrl, { full: true, ph: "https://maps.google.com/…" })}
      ${field("Announcement bar (optional)", "store.announcement", st.announcement, { full: true, ph: "e.g. Free delivery in Lagos on orders over ₦500,000" })}</div></div>
    <div class="card-a"><h2>Social media</h2><div class="form-grid">${["instagram", "facebook", "tiktok", "x", "youtube"].map((k) => field(k[0].toUpperCase() + k.slice(1), `store.social.${k}`, st.social?.[k] || "", { ph: "https://" }))}</div></div>
    <div class="card-a"><h2>Payments</h2>
      <div class="alert alert-info" style="margin-bottom:16px">Payment keys are never stored in the dashboard. Add them to the server's <code>.env</code> file (see the README), then restart. Below, you can switch each method on or off for customers.</div>
      <div style="display:grid;gap:14px">
        <div>${field("Offer Paystack (card, bank, USSD)", "payments.paystack", pay.paystack, { type: "checkbox" })}<div class="small" style="margin-left:28px">${status(c.paystack, "Secret key in server environment")}<br>Webhook URL: <code>${webhookUrls.paystack}</code></div></div>
        <div>${field("Offer Flutterwave (card, bank, mobile money)", "payments.flutterwave", pay.flutterwave, { type: "checkbox" })}<div class="small" style="margin-left:28px">${status(c.flutterwave, "Secret key")} ${status(c.flutterwaveWebhook, "Webhook secret hash")}<br>Webhook URL: <code>${webhookUrls.flutterwave}</code></div></div>
        <div>${field("Offer bank transfer", "payments.bankTransfer", pay.bankTransfer, { type: "checkbox" })}<div class="form-grid" style="margin:10px 0 0 28px">${field("Bank name", "payments.bankName", pay.bankName)}${field("Account name", "payments.accountName", pay.accountName)}${field("Account number", "payments.accountNumber", pay.accountNumber, { attrs: 'inputmode="numeric" maxlength="20"' })}${field("Instructions shown to customer", "payments.transferInstructions", pay.transferInstructions, { type: "textarea", full: true, rows: 2 })}</div></div></div>
      <p class="small muted" style="margin-top:14px">Emails: ${status(c.smtp, "SMTP for order emails")} · Image storage: ${c.cloudinary ? "Cloudinary" : "Server disk (/uploads)"}</p></div>
    <div class="card-a"><h2>Delivery and shop</h2><div class="form-grid">
      <div class="field full">${field("Allow store pickup (free)", "delivery.pickupEnabled", s.delivery.pickupEnabled, { type: "checkbox" })}</div>${field("Pickup note", "delivery.pickupNote", s.delivery.pickupNote, { ph: "Ready within 2 hours, bring your order reference" })}
      ${field("Low-stock alert default", "shop.lowStockThreshold", s.shop.lowStockThreshold, { type: "number", hint: "Used for new products." })}${field("Return window (days)", "shop.returnsWindowDays", s.shop.returnsWindowDays, { type: "number", hint: "Fills {{returnDays}} in the returns policy." })}</div>
      <p class="muted small" style="margin-top:12px">Delivery fees and states are managed under <a href="#/delivery">Delivery zones</a>.</p></div>
    <div class="card-a"><h2>Homepage trust strip</h2><p class="muted small" style="margin-top:-8px">Up to four short reassurance points under the hero banner. Keep them true to how your business works.</p>${tr.html}</div>
    <div class="sticky-save"><button class="btn btn-primary btn-lg" type="submit">Save settings</button></div></form>`.toString();
  const form = $("#sform");
  bindRepeaters(form, { trust: tr });
  const set = (obj, path, val) => { const ks = path.split("."); let o = obj; ks.slice(0, -1).forEach((k) => (o = o[k] ||= {})); o[ks.at(-1)] = val; };
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); clearAlert(form); clearFieldErrors(form);
    const d = readForm(form), body = {};
    for (const [k, v] of Object.entries(d)) set(body, k, v);
    body.shop.lowStockThreshold ??= 3; body.shop.returnsWindowDays ??= 7;
    body.trust = readRepeater(form, "trust", TRUST).filter((t) => t.title);
    await withLoading($("button[type=submit]", form), async () => { try { await api("/settings", { method: "PUT", body }); toast("Settings saved"); } catch (err) { if (!showFieldErrors(form, Object.fromEntries(Object.entries(err.fields || {}).map(([k, v]) => [k, v])))) formAlert(form, err.message); } });
  });
});
