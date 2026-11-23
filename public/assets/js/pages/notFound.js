import { html, $ } from "../core/html.js";
import { initLayout } from "../core/layout.js";
await initLayout();
const app = $("#app"); app.className = "";
app.innerHTML = html`<div class="wrap empty" style="padding-block:80px"><h1>We can't find that page</h1><p>The link may be old or mistyped.</p><a class="btn btn-primary btn-lg" href="/shop">Browse the store</a></div>`.toString();
