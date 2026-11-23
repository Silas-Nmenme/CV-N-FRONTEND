import { html, $ } from "../core/html.js";
import { icon } from "../core/icons.js";
import { post } from "../core/api.js";
import { initLayout, waLink } from "../core/layout.js";
import { setTitle, toast, showFieldErrors, formAlert, clearAlert, clearFieldErrors, withLoading } from "../core/ui.js";
import { session, loadSession } from "../core/state.js";

const cfg = await initLayout();
setTitle("Contact us", cfg.store.name);
await loadSession();
const s = cfg.store, u = session.user;
const app = $("#app"); app.className = "";
const wa = waLink(cfg, `Hello ${s.name}, I have a question.`);
app.innerHTML = html`<div class="wrap" style="padding-top:24px"><h1>Contact us</h1><p class="muted" style="max-width:560px">Questions about a product, an order or delivery? Send a message and we'll get back to you.</p>
<div class="contact-grid"><div class="panel"><form id="f" novalidate><div class="form-grid"><div class="field"><label for="name">Your name</label><input class="input" id="name" name="name" autocomplete="name" value="${u?.name || ""}"></div><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" value="${u?.email || ""}"></div>
<div class="field"><label for="phone">Phone (optional)</label><input class="input" id="phone" name="phone" type="tel" placeholder="0803 123 4567" value="${(u?.phone || "").replace("+234", "0")}"></div><div class="field"><label for="subject">Subject</label><input class="input" id="subject" name="subject" maxlength="150"></div>
<div class="field full"><label for="message">Message</label><textarea class="textarea" id="message" name="message" style="min-height:140px"></textarea></div></div><button class="btn btn-primary btn-lg" type="submit">Send message</button></form></div>
<div><ul class="contact-list">${s.phone ? html`<li>${icon("phone")}<div><b>Call us</b><br><a href="tel:${s.phone.replace(/\s/g, "")}">${s.phone}</a></div></li>` : ""}${wa ? html`<li>${icon("whatsapp")}<div><b>WhatsApp</b><br><a href="${wa}" target="_blank" rel="noopener">Chat with us</a></div></li>` : ""}${s.email ? html`<li>${icon("mail")}<div><b>Email</b><br><a href="mailto:${s.email}">${s.email}</a></div></li>` : ""}${s.address ? html`<li>${icon("pin")}<div><b>Visit us</b><br>${s.address}${s.mapUrl ? html`<br><a href="${s.mapUrl}" target="_blank" rel="noopener">View on map</a>` : ""}</div></li>` : ""}${s.openingHours ? html`<li>${icon("clock")}<div><b>Opening hours</b><br>${s.openingHours}</div></li>` : ""}</ul>
${!s.phone && !s.email && !s.address && !wa ? html`<div class="alert alert-info">Use the form and we'll reply by email.</div>` : ""}</div></div></div>`.toString();
$("#f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target; clearAlert(f); clearFieldErrors(f);
  await withLoading(f.querySelector("button"), async () => {
    try { const r = await post("/contact", { name: f.name.value, email: f.email.value, phone: f.phone.value || undefined, subject: f.subject.value || undefined, message: f.message.value }); f.reset(); formAlert(f, r.message, "ok"); toast(r.message); }
    catch (err) { if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); }
  });
});
