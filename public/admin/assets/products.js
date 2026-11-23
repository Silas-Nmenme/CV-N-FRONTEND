import { html, raw, $, $$, icon, api, naira, table, pager, field, readForm, lines, csv, imageUploader } from "./lib.js";
import { register } from "./admin.js";
import { toast, confirmDialog, withLoading, formAlert, clearAlert, showFieldErrors, clearFieldErrors } from "/assets/js/core/ui.js";
import { assetUrl } from "/assets/js/core/api.js";

/* ------------------------------ list ------------------------------ */
register("products", async (view, parts) => {
  if (parts[0]) return editor(view, parts[0]);
  const st = { page: 1, q: "", category: "", status: "", stock: "" };
  const [cats, brands] = await Promise.all([api("/categories"), api("/brands")]);
  const catOpts = [["", "All categories"], ...cats.items.map((c) => [c.slug, (c.parent ? "— " : "") + c.name])];
  view.innerHTML = html`<div class="a-head"><h1>Products</h1><a class="btn btn-primary" href="#/products/new">${icon("plus")} Add product</a></div>
  <div class="filters-row"><input class="input grow" id="q" placeholder="Search name, model or SKU" type="search"><select class="select" id="category">${catOpts.map(([v, l]) => html`<option value="${v}">${l}</option>`)}</select>
  <select class="select" id="status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Hidden</option></select>
  <select class="select" id="stock"><option value="">Any stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></div><div id="list"></div>`.toString();
  const load = async () => {
    const r = await api("/products", { query: st });
    $("#list").innerHTML = html`${table([
      { h: "Product", f: (p) => html`<div style="display:flex;gap:12px;align-items:center"><img class="th" src="${assetUrl(p.images?.[0]?.thumb || p.images?.[0]?.url || "")}" alt=""><div><a class="name" href="#/products/${p._id}">${p.name}</a><div class="sub">${p.brandName} · ${p.categoryName}</div></div></div>` },
      { h: "Price", f: (p) => (p.maxPrice > p.minPrice ? `${naira(p.minPrice)} – ${naira(p.maxPrice)}` : naira(p.minPrice)) },
      { h: "Stock", f: (p) => html`<span class="tag ${p.totalStock === 0 ? "tag-out" : p.variants.some((v) => v.stock > 0 && v.stock <= p.lowStockThreshold) ? "tag-low" : "tag-ok"}">${p.totalStock}</span> <span class="sub">${p.variants.length} variant${p.variants.length > 1 ? "s" : ""}</span>` },
      { h: "Labels", f: (p) => html`${p.featured ? html`<span class="tag tag-new">Featured</span> ` : ""}${p.bestseller ? html`<span class="tag tag-hot">Bestseller</span> ` : ""}${p.newArrival ? html`<span class="tag">New</span> ` : ""}${p.onOffer ? html`<span class="tag tag-sale">Offer</span>` : ""}` },
      { h: "Visible", f: (p) => html`<label class="check"><input type="checkbox" data-vis="${p._id}" ${p.active ? "checked" : ""} aria-label="Visible in store"></label>` },
      { h: "", r: true, f: (p) => html`<a class="btn btn-ghost btn-sm" href="#/products/${p._id}">Edit</a> <button class="btn btn-danger btn-sm" data-del="${p._id}" data-name="${p.name}" aria-label="Delete ${p.name}">${icon("trash")}</button>` },
    ], r.items, { empty: "No products match." })}<p class="muted small" style="margin-top:10px">${r.total} product${r.total === 1 ? "" : "s"}</p>${pager(r.page, r.pages)}`.toString();
  };
  let tmr;
  $("#q").oninput = (e) => { clearTimeout(tmr); tmr = setTimeout(() => { st.q = e.target.value; st.page = 1; load(); }, 300); };
  for (const id of ["category", "status", "stock"]) $("#" + id).onchange = (e) => { st[id] = e.target.value; st.page = 1; load(); };
  view.onclick = async (e) => {
    const pg = e.target.closest("[data-pg]"); if (pg) { st.page = Number(pg.dataset.pg); load(); }
    const d = e.target.closest("[data-del]");
    if (d && (await confirmDialog(`Delete “${d.dataset.name}” permanently? Past orders keep their own copy of the item. To hide it instead, untick “Visible”.`, "Delete product"))) { try { await api(`/products/${d.dataset.del}`, { method: "DELETE" }); toast("Product deleted"); load(); } catch (err) { toast(err.message, "err"); } }
  };
  view.onchange = async (e) => { const v = e.target.closest("[data-vis]"); if (v) { try { await api(`/products/${v.dataset.vis}/quick`, { method: "PATCH", body: { active: v.checked } }); toast(v.checked ? "Product is visible" : "Product hidden"); } catch (err) { toast(err.message, "err"); v.checked = !v.checked; } } };
  load();
});

/* ------------------------------ editor ------------------------------ */
async function editor(view, id) {
  const isNew = id === "new";
  const [cats, brands, existing] = await Promise.all([api("/categories"), api("/brands"), isNew ? null : api(`/products/${id}`)]);
  const p = existing?.item || { name: "", series: "", model: "", description: "", highlights: [], specs: {}, warranty: "", network: "", tags: [], images: [], variants: [], featured: false, bestseller: false, newArrival: false, onOffer: false, active: true };
  let template = { specFields: [], variantAttrs: [] };
  let variants = p.variants.length ? p.variants.map((v) => ({ ...v })) : [];

  view.innerHTML = html`<div class="a-head"><div><a href="#/products" class="small">← Products</a><h1>${isNew ? "Add product" : "Edit product"}</h1></div>${!isNew ? html`<a class="btn btn-ghost" href="/p/${p.slug}" target="_blank" rel="noopener">View in store ↗</a>` : ""}</div>
  <form class="a-form" id="pform" novalidate>
    <div class="card-a"><h2>Basics</h2><div class="form-grid">
      ${field("Product name", "name", p.name, { full: true, ph: "e.g. iPhone 15 Pro Max" })}
      <div class="field"><label for="f_category">Category</label><select class="select" id="f_category" name="category"><option value="">Select a category</option>${cats.items.map((c) => html`<option value="${c._id}" ${String(p.category) === c._id ? "selected" : ""}>${c.parent ? "— " : ""}${c.name}</option>`)}</select><div class="hint">The category decides which specification fields and options appear below.</div></div>
      <div class="field"><label for="f_brand">Brand</label><select class="select" id="f_brand" name="brand"><option value="">Select a brand</option>${brands.items.map((b) => html`<option value="${b._id}" ${String(p.brand) === b._id ? "selected" : ""}>${b.name}</option>`)}</select></div>
      ${field("Series", "series", p.series, { ph: "iPhone 15, EliteBook, Galaxy S…", hint: "Groups related models." })}${field("Model", "model", p.model, { ph: "Pro Max, 840 G8…" })}
      ${field("Description", "description", p.description, { type: "textarea", full: true, rows: 5 })}
      ${field("Key highlights (one per line)", "highlights", (p.highlights || []).join("\n"), { type: "textarea", full: true, rows: 4 })}
      ${field("Warranty", "warranty", p.warranty, { full: true, ph: "e.g. 6 months seller warranty" })}
      ${field("Network / SIM notes", "network", p.network, { ph: "Dual SIM, 5G, factory unlocked", hint: "For phones and cellular tablets." })}${field("Search tags (comma separated)", "tags", (p.tags || []).join(", "), { ph: "ios, pro, 256gb" })}</div></div>
    <div class="card-a"><h2>Images</h2><div id="images"></div></div>
    <div class="card-a"><h2>Specifications</h2><div id="specs"><p class="muted">Choose a category to see its specification fields.</p></div></div>
    <div class="card-a"><h2>Variants, prices and stock</h2><p class="muted small" style="margin-top:-8px">Each row is something a customer can buy: one combination of storage, colour, condition and so on. Prices are in Naira.</p><div id="variants"></div></div>
    <div class="card-a"><h2>Visibility and labels</h2><div class="checks">${field("Visible in store", "active", p.active, { type: "checkbox" })}${field("Featured", "featured", p.featured, { type: "checkbox" })}${field("Best seller", "bestseller", p.bestseller, { type: "checkbox" })}${field("New arrival", "newArrival", p.newArrival, { type: "checkbox" })}${field("On offer", "onOffer", p.onOffer, { type: "checkbox" })}</div>
      <div class="form-grid" style="margin-top:16px;max-width:420px">${field("Low-stock alert at or below", "lowStockThreshold", p.lowStockThreshold ?? 3, { type: "number" })}</div></div>
    <div class="sticky-save"><a class="btn btn-ghost" href="#/products">Cancel</a><button class="btn btn-primary btn-lg" type="submit">${isNew ? "Create product" : "Save changes"}</button></div>
  </form>`.toString();

  const form = $("#pform");
  const images = imageUploader($("#images"), p.images || [], { folder: "products", max: 12 });

  function drawSpecs() {
    const box = $("#specs");
    if (!form.category.value) return (box.innerHTML = `<p class="muted">Choose a category to see its specification fields.</p>`);
    const known = new Set(template.specFields.map((f) => f.key));
    const extra = Object.keys(p.specs || {}).filter((k) => !known.has(k));
    box.innerHTML = template.specFields.length || extra.length ? html`<div class="form-grid">${template.specFields.map((f) => html`<div class="field"><label for="spec_${f.key}">${f.label}${f.unit ? ` (${f.unit})` : ""}</label>${f.type === "select" && f.options?.length ? html`<select class="select" data-spec="${f.key}" id="spec_${f.key}"><option value="">—</option>${f.options.map((o) => html`<option ${String(p.specs?.[f.key]) === o ? "selected" : ""}>${o}</option>`)}</select>` : html`<input class="input" data-spec="${f.key}" id="spec_${f.key}" type="${f.type === "number" ? "number" : "text"}" step="any" value="${p.specs?.[f.key] ?? ""}">`}${f.group ? html`<div class="hint">${f.group}</div>` : ""}</div>`)}${extra.map((k) => html`<div class="field"><label>${k}</label><input class="input" data-spec="${k}" value="${p.specs[k]}"></div>`)}</div>`.toString() : `<p class="muted">This category has no specification fields yet. Add some under Categories.</p>`;
  }

  function drawVariants() {
    const attrs = template.variantAttrs;
    const keys = [...new Set([...attrs.map((a) => a.key), ...variants.flatMap((v) => Object.keys(v.attrs || {}))])];
    const label = (k) => attrs.find((a) => a.key === k)?.label || k;
    $("#variants").innerHTML = html`<div class="rep"><table><thead><tr><th>SKU</th>${keys.map((k) => html`<th>${label(k)}</th>`)}<th>Price (₦)</th><th>Original price (₦)</th><th>Stock</th><th>Battery %</th><th>On sale</th><th></th></tr></thead><tbody>
      ${variants.map((v, i) => html`<tr data-i="${i}"><td><input class="input" data-v="sku" value="${v.sku || ""}" style="min-width:140px" aria-label="SKU"></td>
        ${keys.map((k) => { const opts = attrs.find((a) => a.key === k)?.options || []; return html`<td><input class="input" data-a="${k}" list="dl_${k}" value="${v.attrs?.[k] || ""}" style="min-width:110px" aria-label="${label(k)}">${opts.length ? html`<datalist id="dl_${k}">${opts.map((o) => html`<option value="${o}">`)}</datalist>` : ""}</td>`; })}
        <td><input class="input" data-v="price" type="number" min="0" step="any" value="${v.price ?? ""}" style="min-width:120px" aria-label="Price"></td><td><input class="input" data-v="comparePrice" type="number" min="0" step="any" value="${v.comparePrice ?? ""}" style="min-width:120px" aria-label="Original price"></td>
        <td><input class="input" data-v="stock" type="number" min="0" step="1" value="${v.stock ?? 0}" style="width:84px" aria-label="Stock"></td><td><input class="input" data-v="batteryHealth" type="number" min="0" max="100" value="${v.batteryHealth ?? ""}" style="width:80px" aria-label="Battery health"></td>
        <td><input type="checkbox" data-v="active" ${v.active !== false ? "checked" : ""} aria-label="Active"></td><td style="white-space:nowrap"><button type="button" class="x" data-dup="${i}" title="Duplicate" aria-label="Duplicate variant">${icon("copy")}</button><button type="button" class="x" data-vrm="${i}" aria-label="Remove variant">${icon("trash")}</button></td></tr>`)}</tbody></table></div>
      <button type="button" class="btn btn-ghost btn-sm" id="add-variant" style="margin-top:8px">${icon("plus")} Add variant</button>`.toString();
  }
  const syncVariants = () => {
    variants = $$("#variants tbody tr").map((tr) => {
      const v = { attrs: {} };
      $$("[data-v]", tr).forEach((el) => { const k = el.dataset.v; v[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? null : Number(el.value)) : el.value.trim(); });
      $$("[data-a]", tr).forEach((el) => { if (el.value.trim()) v.attrs[el.dataset.a] = el.value.trim(); });
      return v;
    });
  };
  const syncSpecs = () => { const s = {}; $$("[data-spec]").forEach((el) => { if (el.value !== "") s[el.dataset.spec] = el.type === "number" ? Number(el.value) : el.value.trim(); }); return s; };

  async function loadTemplate() {
    if (!form.category.value) { template = { specFields: [], variantAttrs: [] }; }
    else template = (await api(`/products/template/${form.category.value}`)).template;
    if (!variants.length) variants = [{ sku: "", attrs: {}, price: "", stock: 0, active: true }];
    drawSpecs(); drawVariants();
  }
  form.category.addEventListener("change", () => { p.specs = syncSpecs(); syncVariants(); loadTemplate(); });
  $("#variants").addEventListener("click", (e) => {
    syncVariants();
    if (e.target.closest("#add-variant")) { variants.push({ sku: "", attrs: {}, price: "", stock: 0, active: true }); drawVariants(); }
    const rm = e.target.closest("[data-vrm]"); if (rm) { variants.splice(Number(rm.dataset.vrm), 1); if (!variants.length) variants.push({ sku: "", attrs: {}, price: "", stock: 0, active: true }); drawVariants(); }
    const dup = e.target.closest("[data-dup]"); if (dup) { const c = JSON.parse(JSON.stringify(variants[Number(dup.dataset.dup)])); c.sku = ""; variants.splice(Number(dup.dataset.dup) + 1, 0, c); drawVariants(); }
  });
  await loadTemplate();

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); clearAlert(form); clearFieldErrors(form);
    syncVariants();
    const d = readForm(form);
    const body = {
      name: d.name, brand: d.brand, category: d.category, series: d.series, model: d.model, description: d.description, highlights: lines(d.highlights),
      specs: syncSpecs(), warranty: d.warranty, network: d.network, tags: csv(d.tags), images: images.get(),
      variants: variants.map((v) => ({ sku: v.sku, attrs: v.attrs, price: v.price === null || v.price === "" ? NaN : v.price, comparePrice: v.comparePrice || null, stock: v.stock ?? 0, batteryHealth: v.batteryHealth ?? null, active: v.active })),
      featured: d.featured, bestseller: d.bestseller, newArrival: d.newArrival, onOffer: d.onOffer, active: d.active, lowStockThreshold: d.lowStockThreshold ?? undefined,
    };
    if (body.variants.some((v) => Number.isNaN(v.price))) return formAlert(form, "Every variant needs a price.");
    await withLoading($("button[type=submit]", form), async () => {
      try {
        const r = isNew ? await api("/products", { method: "POST", body }) : await api(`/products/${id}`, { method: "PUT", body });
        toast(isNew ? "Product created" : "Product saved");
        if (isNew) location.hash = `#/products/${r.item._id}`; else { p.specs = body.specs; }
      } catch (err) { if (!showFieldErrors(form, err.fields)) formAlert(form, err.message); }
    });
  });
}
