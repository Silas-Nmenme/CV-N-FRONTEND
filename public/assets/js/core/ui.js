import { html, raw, esc, $, $$ } from "./html.js";
import { icon } from "./icons.js";

export function toast(message, type = "ok") {
  let box = $(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = (type === "ok" ? icon("check").toString() : "") + `<span>${esc(message)}</span>`;
  box.append(t);
  setTimeout(() => t.remove(), 3600);
}

/** Show server-side field errors on a form: { fieldName: message }. Returns true when at least one field was matched. */
export function showFieldErrors(form, fields = {}) {
  clearFieldErrors(form);
  let hit = false;
  for (const [key, msg] of Object.entries(fields)) {
    const name = key.split(".").pop();
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    const field = input?.closest(".field");
    if (field) {
      field.classList.add("has-error");
      let e = field.querySelector(".field-error");
      if (!e) { e = document.createElement("div"); e.className = "field-error"; field.append(e); }
      e.textContent = msg;
      hit = true;
    }
  }
  if (hit) form.querySelector(".has-error .input, .has-error .select, .has-error .textarea")?.focus();
  return hit;
}
export function clearFieldErrors(form) {
  $$(".has-error", form).forEach((f) => f.classList.remove("has-error"));
}
export function formAlert(form, message, type = "error") {
  let a = form.querySelector(".form-alert");
  if (!a) { a = document.createElement("div"); a.className = "form-alert"; form.prepend(a); }
  a.className = `form-alert alert alert-${type}`;
  a.setAttribute("role", "alert");
  a.textContent = message;
  a.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
export const clearAlert = (form) => form.querySelector(".form-alert")?.remove();

export async function withLoading(btn, fn) {
  if (btn.classList.contains("is-loading")) return;
  const label = btn.innerHTML;
  btn.classList.add("is-loading");
  btn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span>`;
  try { return await fn(); } finally { btn.classList.remove("is-loading"); btn.innerHTML = label; }
}

export function modal({ title, body, onClose }) {
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML = html`<div class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">${icon("close")}</button></div><div class="modal-body">${body}</div></div>`.toString();
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); onClose?.(); };
  const onKey = (e) => e.key === "Escape" && close();
  back.addEventListener("click", (e) => { if (e.target === back || e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(back);
  back.querySelector("input,select,textarea,button:not([data-close])")?.focus();
  return { el: back, close };
}

export function confirmDialog(message, okLabel = "Yes, continue") {
  return new Promise((resolve) => {
    const m = modal({ title: "Please confirm", body: html`<p>${message}</p><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-ghost" data-no>Cancel</button><button class="btn btn-primary" data-yes>${okLabel}</button></div>`, onClose: () => resolve(false) });
    m.el.querySelector("[data-no]").onclick = () => m.close();
    m.el.querySelector("[data-yes]").onclick = () => { resolve(true); m.el.remove(); };
  });
}

export const stars = (n, count) => html`<span class="stars" role="img" aria-label="${Number(n).toFixed(1)} out of 5">${[1, 2, 3, 4, 5].map((i) => html`<span class="${i <= Math.round(n) ? "" : "off"}">${icon("star")}</span>`)}</span>`;

/** Lightweight Markdown for admin-edited pages. Output is escaped; only a safe subset of syntax becomes HTML. */
export function markdown(src) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\(((?:\/|https?:\/\/)[^)\s]*)\)/g, '<a href="$2">$1</a>');
  const out = [];
  let list = false, para = [];
  const flush = () => { if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`); para = []; };
  const close = () => { if (list) out.push("</ul>"); list = false; };
  for (const line of String(src).split(/\r?\n/)) {
    if (/^\s*$/.test(line)) { flush(); close(); continue; }
    let m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { flush(); close(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) { flush(); if (!list) out.push("<ul>"); list = true; out.push(`<li>${inline(m[1])}</li>`); }
    else { close(); para.push(line.trim()); }
  }
  flush(); close();
  return raw(out.join(""));
}

export function scrollTopSmooth() { window.scrollTo({ top: 0, behavior: "smooth" }); }
export function setTitle(t, store = "CV GADGETS") { document.title = t ? `${t} | ${store}` : store; }
export function setMeta(desc) { let m = $('meta[name="description"]'); if (!m) { m = document.createElement("meta"); m.name = "description"; document.head.append(m); } m.content = desc; }
