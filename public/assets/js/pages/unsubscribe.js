import { html, $ } from "../core/html.js";
import { post } from "../core/api.js";
import { initLayout } from "../core/layout.js";
const cfg = await initLayout();
const app = $("#app"); app.className = "";
const p = new URLSearchParams(location.search);
let msg, ok = true;
try { msg = (await post("/newsletter/unsubscribe", { email: p.get("email") || "", token: p.get("token") || "" })).message; } catch (e) { msg = e.message; ok = false; }
app.innerHTML = html`<div class="wrap"><div class="panel result-card"><h1>${ok ? "You're unsubscribed" : "Couldn't unsubscribe"}</h1><p>${msg}</p><a class="btn btn-primary" href="/">Back to the store</a></div></div>`.toString();
