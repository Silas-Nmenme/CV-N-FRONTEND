import { html, raw, esc, $, $$ } from "/assets/js/core/html.js";
import { icon } from "/assets/js/core/icons.js";
import { naira } from "/assets/js/core/format.js";
import { apiUrl, assetUrl } from "/assets/js/core/api.js";
export { html, raw, esc, $, $$, icon, naira };

export const api = async (path, { method = "GET", body, query, form } = {}) => {
  let url = apiUrl("/api/admin" + path);
  if (query) { const q = new URLSearchParams(); for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") q.set(k, v); if (q.toString()) url += "?" + q; }
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: form || (body ? JSON.stringify(body) : undefined), credentials: "include" });
  let data = {}; try { data = await res.json(); } catch { /* csv etc */ }
  if (!res.ok) { const e = new Error(data.message || "Something went wrong."); e.status = res.status; e.fields = data.fields; throw e; }
  return data;
};

/* ------------------------------ form fields ------------------------------ */
export function field(label, name, value = "", { type = "text", options, hint, ph = "", full, required, attrs = "", rows } = {}) {
  const id = `f_${name}`;
  let control;
  if (type === "textarea") control = html`<textarea class="textarea" id="${id}" name="${name}" placeholder="${ph}" ${raw(rows ? `style="min-height:${rows * 24}px"` : "")}>${value ?? ""}</textarea>`;
  else if (type === "select") control = html`<select class="select" id="${id}" name="${name}">${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return html`<option value="${v}" ${String(v) === String(value ?? "") ? "selected" : ""}>${l}</option>`; })}</select>`;
  else if (type === "checkbox") return html`<div class="field ${full ? "full" : ""}"><label class="check"><input type="checkbox" name="${name}" ${value ? "checked" : ""}> ${label}</label>${hint ? html`<div class="hint">${hint}</div>` : ""}</div>`;
  else control = html`<input class="input" id="${id}" name="${name}" type="${type}" value="${value ?? ""}" placeholder="${ph}" ${raw(type === "number" ? 'step="any"' : "")} ${raw(attrs)}>`;
  return html`<div class="field ${full ? "full" : ""}"><label for="${id}">${label}</label>${control}${hint ? html`<div class="hint">${hint}</div>` : ""}</div>`;
}

export function repeater(name, cols, rows = [], { addLabel = "Add row" } = {}) {
  const rowHtml = (r = {}) => html`<tr>${cols.map((c) => html`<td style="${c.w ? "min-width:" + c.w : ""}">${c.type === "select" ? html`<select class="select" data-k="${c.k}">${c.options.map((o) => html`<option ${r[c.k] === o ? "selected" : ""}>${o}</option>`)}</select>` : c.type === "checkbox" ? html`<input type="checkbox" data-k="${c.k}" ${r[c.k] ?? c.def ? "checked" : ""} aria-label="${c.label}">` : html`<input class="input" data-k="${c.k}" type="${c.type || "text"}" ${raw(c.type === "number" ? 'step="any"' : "")} value="${c.list ? (r[c.k] || []).join(", ") : r[c.k] ?? c.def ?? ""}" placeholder="${c.ph || ""}" aria-label="${c.label}">`}</td>`)}<td><button type="button" class="x" data-rm aria-label="Remove row">${icon("trash")}</button></td></tr>`;
  return { html: html`<div class="rep" data-rep="${name}"><table><thead><tr>${cols.map((c) => html`<th>${c.label}</th>`)}<th></th></tr></thead><tbody>${rows.map(rowHtml)}</tbody></table></div><button type="button" class="btn btn-ghost btn-sm" data-add-row="${name}" style="margin-top:8px">${icon("plus")} ${addLabel}</button>`, rowHtml, cols };
}
export function bindRepeaters(root, defs) {
  root.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-row]");
    if (add) { const d = defs[add.dataset.addRow]; root.querySelector(`[data-rep="${add.dataset.addRow}"] tbody`).insertAdjacentHTML("beforeend", d.rowHtml({}).toString()); }
    if (e.target.closest("[data-rm]")) e.target.closest("tr").remove();
  });
}
export function readRepeater(root, name, cols) {
  return $$(`[data-rep="${name}"] tbody tr`, root).map((tr) => {
    const o = {};
    for (const c of cols) {
      const el = tr.querySelector(`[data-k="${c.k}"]`);
      if (c.type === "checkbox") o[c.k] = el.checked;
      else if (c.type === "number") o[c.k] = el.value === "" ? null : Number(el.value);
      else if (c.list) o[c.k] = el.value.split(",").map((s) => s.trim()).filter(Boolean);
      else o[c.k] = el.value.trim();
    }
    return o;
  });
}
export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.name.startsWith("_") || el.closest("[data-rep]")) continue;
    if (el.type === "checkbox") out[el.name] = el.checked;
    else if (el.type === "number") out[el.name] = el.value === "" ? null : Number(el.value);
    else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  }
  return out;
}
export const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
export const csv = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

/* ------------------------------ image uploader ------------------------------ */
export function imageUploader(host, initial = [], { folder = "products", max = 8 } = {}) {
  let imgs = initial.map((i) => ({ ...i }));
  const draw = () => {
    host.innerHTML = html`<div class="img-grid">${imgs.map((im, i) => html`<div class="img-tile">${i === 0 && max > 1 ? html`<span class="main">Main</span>` : ""}<img src="${assetUrl(im.thumb || im.url)}" alt="">${i > 0 ? html`<button type="button" class="mv" data-mv="${i}" aria-label="Make main image" title="Move to front">${icon("chevron")}</button>` : ""}<button type="button" data-del="${i}" aria-label="Remove image">${icon("close")}</button></div>`)}
      ${imgs.length < max ? html`<label class="drop"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" ${raw(max > 1 ? "multiple" : "")} hidden><span>${icon("plus")}<br>Add image${max > 1 ? "s" : ""}</span></label>` : ""}</div><div class="hint small muted" style="margin-top:6px">JPG, PNG, WebP or AVIF up to 8 MB. Images are resized and converted automatically.</div>`.toString();
  };
  host.addEventListener("click", (e) => {
    const d = e.target.closest("[data-del]"); if (d) { imgs.splice(Number(d.dataset.del), 1); draw(); }
    const m = e.target.closest("[data-mv]"); if (m) { const [x] = imgs.splice(Number(m.dataset.mv), 1); imgs.unshift(x); draw(); }
  });
  host.addEventListener("change", async (e) => {
    if (e.target.type !== "file" || !e.target.files.length) return;
    const fd = new FormData();
    [...e.target.files].slice(0, max - imgs.length).forEach((f) => fd.append("images", f));
    host.querySelector(".drop span").textContent = "Uploading…";
    try { const r = await api(`/products/upload?folder=${folder}`, { method: "POST", form: fd }); imgs.push(...r.images.map((i) => ({ url: i.url, thumb: i.thumb, publicId: i.publicId, alt: "" }))); }
    catch (err) { (await import("/assets/js/core/ui.js")).toast(err.message, "err"); }
    draw();
  });
  draw();
  return { get: () => imgs, set: (v) => { imgs = v; draw(); } };
}

/* ------------------------------ tables ------------------------------ */
export function table(cols, rows, { empty = "Nothing here yet." } = {}) {
  if (!rows.length) return html`<div class="card-a empty" style="padding:40px">${empty}</div>`;
  return html`<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => html`<th class="${c.r ? "r" : ""}">${c.h}</th>`)}</tr></thead><tbody>${rows.map((r) => html`<tr>${cols.map((c) => html`<td class="${c.r ? "r" : ""}">${c.f(r)}</td>`)}</tr>`)}</tbody></table></div>`;
}
export function pager(page, pages) {
  if (pages <= 1) return "";
  return html`<div class="pagination"><button class="btn btn-ghost btn-sm" data-pg="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹ Prev</button><span style="min-width:90px;text-align:center;display:grid;place-items:center">Page ${page} of ${pages}</span><button class="btn btn-ghost btn-sm" data-pg="${page + 1}" ${page >= pages ? "disabled" : ""}>Next ›</button></div>`;
}
export const dt = (d) => (d ? new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");
export const dshort = (d) => (d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "");
export const dInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/* ------------------------------ charts ------------------------------ */
export function barChart(series, key = "revenue", label = (d) => d.date) {
  const W = 720, H = 220, pad = { l: 56, r: 8, t: 10, b: 24 };
  const max = Math.max(1, ...series.map((d) => d[key]));
  const nice = (m) => { const p = 10 ** Math.floor(Math.log10(m)); return Math.ceil(m / p) * p; };
  const top = max <= 1 ? 1000 : nice(max);
  const bw = (W - pad.l - pad.r) / series.length;
  const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : n);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue chart" preserveAspectRatio="none">
    ${ticks.map((t) => html`<line x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b - (t / top) * (H - pad.t - pad.b)}" y2="${H - pad.b - (t / top) * (H - pad.t - pad.b)}" stroke="#e2e6ee"/><text x="${pad.l - 6}" y="${H - pad.b - (t / top) * (H - pad.t - pad.b) + 3}" text-anchor="end">${key === "revenue" ? "₦" + short(t) : short(t)}</text>`)}
    ${series.map((d, i) => { const h = (d[key] / top) * (H - pad.t - pad.b); return html`<rect x="${pad.l + i * bw + 1.5}" y="${H - pad.b - h}" width="${Math.max(2, bw - 3)}" height="${h}" rx="2" fill="#2145f5"><title>${label(d)}: ${key === "revenue" ? naira(d[key]) : d[key]}</title></rect>`; })}
    ${series.map((d, i) => (i % Math.ceil(series.length / 8) === 0 ? html`<text x="${pad.l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${String(label(d)).slice(-5)}</text>` : ""))}</svg>`;
}
