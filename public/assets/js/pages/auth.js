import { html, $ } from "../core/html.js";
import { icon } from "../core/icons.js";
import { post } from "../core/api.js";
import { initLayout } from "../core/layout.js";
import { setTitle, showFieldErrors, formAlert, clearAlert, clearFieldErrors, withLoading } from "../core/ui.js";
import { afterSignIn, loadSession, session } from "../core/state.js";
import { postAuthPath } from "../core/auth-redirect.js";

const cfg = await initLayout();
const app = $("#app"); app.className = "";
const page = location.pathname.slice(1);
const params = new URLSearchParams(location.search);
const rawNext = params.get("next") || "";
await loadSession();
if (session.user && ["login", "register"].includes(page)) location.replace(postAuthPath(session.user, rawNext));

const shell = (title, sub, body, footer) => { app.innerHTML = html`<div class="wrap"><div class="auth-wrap"><div class="panel"><h1>${title}</h1><p class="muted">${sub}</p>${body}</div><p class="center small" style="margin-top:16px">${footer}</p></div></div>`.toString(); };
const pw = (id, label, auto) => html`<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" type="password" autocomplete="${auto}"></div>`;

const forms = {
  login: () => { setTitle("Sign in", cfg.store.name);
    shell("Welcome back", "Sign in to track orders and check out faster.", html`<form id="f" novalidate><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email"></div>${pw("password", "Password", "current-password")}<div style="text-align:right;margin:-6px 0 14px"><a class="small" href="/forgot-password">Forgot password?</a></div><button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button></form>`, html`New here? <a href="/register${rawNext ? "?next=" + encodeURIComponent(rawNext) : ""}">Create an account</a>`);
    return async (f) => { const r = await post("/auth/login", { email: f.email.value.trim(), password: f.password.value }); await afterSignIn(r.user); location.href = postAuthPath(r.user, rawNext); }; },
  register: () => { setTitle("Create account", cfg.store.name);
    shell("Create your account", "Save addresses, track orders and keep a wishlist.", html`<form id="f" novalidate><div class="field"><label for="name">Full name</label><input class="input" id="name" name="name" autocomplete="name"></div><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email"></div><div class="field"><label for="phone">Phone (optional)</label><input class="input" id="phone" name="phone" type="tel" placeholder="0803 123 4567" autocomplete="tel"></div>${pw("password", "Password", "new-password")}<div class="hint" style="margin:-10px 0 14px;font-size:.8rem;color:var(--ink-3)">At least 8 characters with a letter and a number.</div><label class="check" style="margin-bottom:16px"><input type="checkbox" name="newsletter"> Send me offers and new arrivals</label><button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button></form>`, html`Already have an account? <a href="/login${rawNext ? "?next=" + encodeURIComponent(rawNext) : ""}">Sign in</a>`);
    return async (f) => { const r = await post("/auth/register", { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim() || undefined, password: f.password.value, newsletter: f.newsletter.checked }); await afterSignIn(r.user); location.href = postAuthPath(r.user, rawNext); }; },
  "forgot-password": () => { setTitle("Forgot password", cfg.store.name);
    shell("Reset your password", "Enter your email and we'll send you a reset link.", html`<form id="f" novalidate><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email"></div><button class="btn btn-primary btn-lg btn-block" type="submit">Send reset link</button></form>`, html`<a href="/login">Back to sign in</a>`);
    return async (f) => { const r = await post("/auth/forgot-password", { email: f.email.value.trim() }); formAlert(f, r.message, "ok"); f.querySelector("button").disabled = true; }; },
  "reset-password": () => { setTitle("Choose a new password", cfg.store.name);
    const token = params.get("token") || "";
    shell("Choose a new password", "Pick something you haven't used elsewhere.", html`<form id="f" novalidate>${pw("password", "New password", "new-password")}${pw("confirm", "Confirm password", "new-password")}<button class="btn btn-primary btn-lg btn-block" type="submit">Update password</button></form>`, html`<a href="/login">Back to sign in</a>`);
    return async (f) => { if (f.password.value !== f.confirm.value) throw Object.assign(new Error("Passwords do not match."), { fields: { confirm: "Passwords do not match." } }); const r = await post("/auth/reset-password", { token, password: f.password.value }); await afterSignIn(r.user); location.href = postAuthPath(r.user, rawNext); }; },
};

const submit = forms[page]?.();
$("#f")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target; clearAlert(f); clearFieldErrors(f);
  await withLoading(f.querySelector("button[type=submit]"), async () => {
    try { await submit(f); } catch (err) { if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); }
  });
});
