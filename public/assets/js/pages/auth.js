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
const toCheckout = /^\/checkout(?:[/?#]|$)/.test(rawNext); // arrived here from checkout: say so, and checkout resumes after sign-in
await loadSession();
if (session.user && ["login", "register"].includes(page)) location.replace(postAuthPath(session.user, rawNext));

const shell = (title, sub, body, footer) => { app.innerHTML = html`<div class="wrap"><div class="auth-wrap"><div class="panel"><h1>${title}</h1><p class="muted">${sub}</p>${body}</div><p class="center small" style="margin-top:16px">${footer}</p></div></div>`.toString(); };
const pw = (id, label, auto) => html`<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" name="${id}" type="password" autocomplete="${auto}"></div>`;

const forms = {
  login: () => { setTitle("Sign in", cfg.store.name);
    shell("Welcome back", toCheckout ? "Sign in to complete your order. Your cart is saved." : "Sign in to track orders and check out faster.", html`<form id="f" novalidate><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email"></div>${pw("password", "Password", "current-password")}<div style="text-align:right;margin:-6px 0 14px"><a class="small" href="/forgot-password">Forgot password?</a></div><button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button></form>`, html`New here? <a href="/register${rawNext ? "?next=" + encodeURIComponent(rawNext) : ""}">Create an account</a>`);
    return async (f) => {
      try { const r = await post("/auth/login", { email: f.email.value.trim(), password: f.password.value }); await afterSignIn(r.user); location.href = postAuthPath(r.user, rawNext); }
      catch (err) {
        if (err.data?.code === "EMAIL_NOT_VERIFIED") return otpScreen({ email: err.data.email || f.email.value.trim(), emailSent: err.data.emailSent !== false, reason: err.data.reason, retryAfter: err.data.retryAfter });
        throw err;
      }
    }; },
  register: () => { setTitle("Create account", cfg.store.name);
    shell("Create your account", toCheckout ? "Create an account to complete your order. Your cart is saved." : "Save addresses, track orders and keep a wishlist.", html`<form id="f" novalidate><div class="field"><label for="name">Full name</label><input class="input" id="name" name="name" autocomplete="name"></div><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email"></div><div class="field"><label for="phone">Phone (optional)</label><input class="input" id="phone" name="phone" type="tel" placeholder="0803 123 4567" autocomplete="tel"></div>${pw("password", "Password", "new-password")}<div class="hint" style="margin:-10px 0 14px;font-size:.8rem;color:var(--ink-3)">At least 8 characters with a letter and a number.</div><label class="check" style="margin-bottom:16px"><input type="checkbox" name="newsletter"> Send me offers and new arrivals</label><button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button></form>`, html`Already have an account? <a href="/login${rawNext ? "?next=" + encodeURIComponent(rawNext) : ""}">Sign in</a>`);
    return async (f) => { const r = await post("/auth/register", { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim() || undefined, password: f.password.value, newsletter: f.newsletter.checked });
      if (r.verificationRequired) return otpScreen({ email: r.email, emailSent: r.emailSent !== false, reason: r.reason, retryAfter: r.retryAfter });
      await afterSignIn(r.user); location.href = postAuthPath(r.user, rawNext); }; },
  "forgot-password": () => { setTitle("Forgot password", cfg.store.name);
    shell("Reset your password", "Enter your email and we'll send you a reset link.", html`<form id="f" novalidate><div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email"></div><button class="btn btn-primary btn-lg btn-block" type="submit">Send reset link</button></form>`, html`<a href="/login">Back to sign in</a>`);
    return async (f) => { const r = await post("/auth/forgot-password", { email: f.email.value.trim() }); formAlert(f, r.message, "ok"); f.querySelector("button").disabled = true; }; },
  "reset-password": () => { setTitle("Choose a new password", cfg.store.name);
    const token = params.get("token") || "";
    shell("Choose a new password", "Pick something you haven't used elsewhere.", html`<form id="f" novalidate>${pw("password", "New password", "new-password")}${pw("confirm", "Confirm password", "new-password")}<button class="btn btn-primary btn-lg btn-block" type="submit">Update password</button></form>`, html`<a href="/login">Back to sign in</a>`);
    return async (f) => { if (f.password.value !== f.confirm.value) throw Object.assign(new Error("Passwords do not match."), { fields: { confirm: "Passwords do not match." } }); const r = await post("/auth/reset-password", { token, password: f.password.value }); await afterSignIn(r.user); location.href = postAuthPath(r.user, rawNext); }; },
};

/* ----------------------- email verification (6-digit code) ----------------------- */
const maskEmail = (e) => e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(b.length, 5)) + c);
function otpScreen({ email, emailSent = true, reason = "", retryAfter = 60 }) {
  setTitle("Verify your email", cfg.store.name);
  shell(
    "Check your email",
    html`We sent a 6-digit code to <b>${maskEmail(email)}</b>. It expires in 10 minutes. Can't find it? Check your spam folder.`,
    html`<form id="f" novalidate><div class="field"><label for="code">Verification code</label><input class="input" id="code" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="••••••" style="text-align:center;font-size:1.5rem;letter-spacing:.45em"></div><button class="btn btn-primary btn-lg btn-block" type="submit">Verify and continue</button></form><div class="center" style="margin-top:14px"><button class="btn btn-ghost btn-sm" type="button" id="resend">Resend code</button></div>`,
    html`Wrong email? <a href="/register${rawNext ? "?next=" + encodeURIComponent(rawNext) : ""}">Start again</a>`
  );
  const f = $("#f"), input = $("#code"), resend = $("#resend");
  let timer;
  const cooldown = (secs) => {
    clearInterval(timer);
    let left = Math.max(0, Math.ceil(Number(secs) || 0));
    const paint = () => { resend.disabled = left > 0; resend.textContent = left <= 0 ? "Resend code" : left > 120 ? `Try again in ${Math.ceil(left / 60)} min` : `Resend code in ${left}s`; };
    paint();
    if (left > 0) timer = setInterval(() => { left -= 1; paint(); if (left <= 0) clearInterval(timer); }, 1000);
  };
  if (!emailSent && reason === "cooldown") formAlert(f, "We sent you a code a moment ago. Check your inbox (and spam folder), or ask for a new one shortly.", "warn");
  else if (!emailSent) formAlert(f, "We couldn't send the email just now. Tap “Resend code” to try again.", "warn");
  cooldown(emailSent || reason === "cooldown" ? retryAfter ?? 60 : 0);

  f.addEventListener("submit", async (e) => {
    e.preventDefault(); clearAlert(f);
    const code = input.value.replace(/\D/g, "");
    if (code.length !== 6) return formAlert(f, "Enter the 6-digit code from your email.");
    await withLoading(f.querySelector("button[type=submit]"), async () => {
      try { const r = await post("/auth/verify-email", { email, code }); await afterSignIn(r.user); location.href = postAuthPath(r.user, rawNext); }
      catch (err) { formAlert(f, err.message); input.select(); }
    });
  });
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 6);
    if (input.value.length === 6) (f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })));
  });
  resend.addEventListener("click", async () => {
    clearAlert(f); resend.disabled = true;
    try { const r = await post("/auth/resend-otp", { email }); formAlert(f, "New code sent. Check your inbox (and spam folder).", "ok"); cooldown(r.resendAfter ?? 60); input.value = ""; input.focus(); }
    catch (err) { formAlert(f, err.message, err.data?.code === "OTP_COOLDOWN" ? "warn" : "error"); cooldown(err.data?.retryAfter ?? 0); }
  });
  input.focus();
}

const submit = forms[page]?.();
$("#f")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target; clearAlert(f); clearFieldErrors(f);
  await withLoading(f.querySelector("button[type=submit]"), async () => {
    try { await submit(f); } catch (err) { if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); }
  });
});
