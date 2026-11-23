import { html, raw, $, $$, icon, api, naira, table, pager, field, repeater, bindRepeaters, readRepeater, readForm, imageUploader, barChart, dt, dshort, dInput, esc } from "./lib.js";
import { register, can, ctx } from "./admin.js";
import { toast, modal, confirmDialog, withLoading, formAlert, clearAlert, showFieldErrors, clearFieldErrors } from "/assets/js/core/ui.js";
import { get, apiUrl } from "/assets/js/core/api.js";

/* ---------------- generic list + modal form page ---------------- */
function crudPage(view, o) {
  const st = { page: 1, q: "" };
  view.innerHTML = html`<div class="a-head"><h1>${o.title}</h1><button class="btn btn-primary" id="add">${icon("plus")} ${o.addLabel}</button></div>
    ${o.search !== false ? html`<div class="filters-row"><input class="input grow" id="q" type="search" placeholder="Search…"></div>` : ""}${o.intro ? html`<p class="muted" style="max-width:760px">${o.intro}</p>` : ""}<div id="list"></div>`.toString();
  let items = [];
  const load = async () => {
    const r = await api(o.path, { query: st });
    items = r.items;
    $("#list").innerHTML = html`${table([...o.cols, { h: "", r: true, f: (i) => html`<button class="btn btn-ghost btn-sm" data-edit="${i._id}">Edit</button> <button class="btn btn-danger btn-sm" data-del="${i._id}" aria-label="Delete">${icon("trash")}</button>` }], items, { empty: o.empty || "Nothing here yet." })}${pager(r.page, r.pages)}`.toString();
  };
  let tmr;
  $("#q")?.addEventListener("input", (e) => { clearTimeout(tmr); tmr = setTimeout(() => { st.q = e.target.value; st.page = 1; load(); }, 300); });
  async function open(item) {
    const f0 = await o.form(item);
    const m = modal({ title: `${item ? "Edit" : "Add"} ${o.noun}`, body: html`<form novalidate id="crud-form">${f0.html}<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>` });
    if (o.wide) m.el.querySelector(".modal").classList.add("wide");
    const form = m.el.querySelector("form");
    const ctxObj = f0.setup?.(form) || {};
    if (f0.defs) bindRepeaters(form, f0.defs);
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); clearAlert(form); clearFieldErrors(form);
      await withLoading(form.querySelector("button[type=submit]"), async () => {
        try {
          const body = o.read(form, ctxObj, item);
          item ? await api(`${o.path}/${item._id}`, { method: "PUT", body }) : await api(o.path, { method: "POST", body });
          m.close(); toast("Saved"); load();
        } catch (err) { if (!showFieldErrors(form, err.fields)) formAlert(form, err.message); }
      });
    });
  }
  $("#add").onclick = () => open(null);
  view.onclick = async (e) => {
    const ed = e.target.closest("[data-edit]"); if (ed) return open(items.find((i) => i._id === ed.dataset.edit));
    const pg = e.target.closest("[data-pg]"); if (pg) { st.page = Number(pg.dataset.pg); return load(); }
    const d = e.target.closest("[data-del]");
    if (d && (await confirmDialog(`Delete this ${o.noun}? This can't be undone.`, "Delete"))) { try { await api(`${o.path}/${d.dataset.del}`, { method: "DELETE" }); toast("Deleted"); load(); } catch (err) { toast(err.message, "err"); } }
  };
  return load();
}
const num = (v) => (v === "" || v == null ? null : Number(v));
const yn = (b) => (b ? html`<span class="tag tag-ok">Yes</span>` : html`<span class="tag">No</span>`);

/* ---------------- categories ---------------- */
register("categories", async (view) => {
  const all = (await api("/categories", { query: { limit: 200 } })).items;
  const SPEC_COLS = [{ k: "key", label: "Key", ph: "screenSize", w: "110px" }, { k: "label", label: "Label", ph: "Screen size", w: "120px" }, { k: "type", label: "Type", type: "select", options: ["text", "number", "select"] }, { k: "unit", label: "Unit", ph: "inch", w: "70px" }, { k: "options", label: "Choices (for select)", list: true, ph: "a, b, c", w: "130px" }, { k: "group", label: "Group", def: "Specifications", w: "120px" }, { k: "filterable", label: "Filter", type: "checkbox" }];
  const VAR_COLS = [{ k: "key", label: "Key", ph: "storage", w: "100px" }, { k: "label", label: "Label", ph: "Storage", w: "110px" }, { k: "options", label: "Suggested values", list: true, ph: "128GB, 256GB", w: "200px" }, { k: "filterable", label: "Filter", type: "checkbox", def: true }, { k: "swatch", label: "Colour chips", type: "checkbox" }];
  return crudPage(view, {
    title: "Categories", noun: "category", addLabel: "Add category", path: "/categories", wide: true,
    intro: "Each category defines the specification fields and options (storage, colour, condition…) that appear when you add a product to it. A phone never shows laptop fields.",
    cols: [{ h: "Name", f: (c) => html`<b>${c.parent ? "— " : ""}${c.name}</b><div class="sub">/category/${c.slug}</div>` }, { h: "Parent", f: (c) => all.find((x) => x._id === c.parent)?.name || "—" }, { h: "Spec fields", f: (c) => c.specFields?.length || 0 }, { h: "Options", f: (c) => (c.variantAttrs || []).map((a) => a.label).join(", ") || "—" }, { h: "In menu", f: (c) => yn(c.showInNav) }, { h: "Visible", f: (c) => yn(c.active) }],
    form: (c) => {
      c = c || { specFields: [], variantAttrs: [], active: true, showInNav: true, navPromoted: false, sortOrder: 0 };
      const sp = repeater("specFields", SPEC_COLS, c.specFields, { addLabel: "Add specification field" });
      const va = repeater("variantAttrs", VAR_COLS, c.variantAttrs, { addLabel: "Add option" });
      return { html: html`<div class="form-grid">${field("Name", "name", c.name, { ph: "e.g. Smartwatches" })}
        <div class="field"><label for="f_parent">Parent category</label><select class="select" id="f_parent" name="parent"><option value="">None (top level)</option>${all.filter((x) => x._id !== c._id && !x.parent).map((x) => html`<option value="${x._id}" ${String(c.parent) === x._id ? "selected" : ""}>${x.name}</option>`)}</select></div>
        ${field("Description", "description", c.description, { type: "textarea", full: true })}${field("Sort order", "sortOrder", c.sortOrder, { type: "number" })}<div class="field"><label>Image</label><div id="cat-img"></div></div></div>
        <div class="checks" style="margin:8px 0 18px">${field("Visible in store", "active", c.active, { type: "checkbox" })}${field("Show in menus", "showInNav", c.showInNav, { type: "checkbox" })}${field("Show as its own menu item", "navPromoted", c.navPromoted, { type: "checkbox", hint: "For sub-categories like MacBooks or iPads." })}</div>
        <h3>Specification fields</h3><p class="muted small">Shown on product pages (e.g. Processor, Display). Tick “Filter” to let shoppers filter by it. Keys use letters and numbers only.</p>${sp.html}
        <h3 style="margin-top:22px">Variant options</h3><p class="muted small">What a buyer chooses between: storage, colour, condition…</p>${va.html}`, defs: { specFields: sp, variantAttrs: va }, setup: () => ({ img: imageUploader($("#cat-img"), c.image ? [{ url: c.image, thumb: c.image }] : [], { folder: "categories", max: 1 }) }) };
    },
    read: (f, x) => { const d = readForm(f); return { name: d.name, parent: d.parent || null, description: d.description, image: x.img.get()[0]?.url || "", sortOrder: d.sortOrder ?? 0, active: d.active, showInNav: d.showInNav, navPromoted: d.navPromoted, specFields: readRepeater(f, "specFields", SPEC_COLS).filter((r) => r.key), variantAttrs: readRepeater(f, "variantAttrs", VAR_COLS).filter((r) => r.key) }; },
  });
});

/* ---------------- brands ---------------- */
register("brands", (view) => crudPage(view, {
  title: "Brands", noun: "brand", addLabel: "Add brand", path: "/brands",
  cols: [{ h: "Brand", f: (b) => html`<b>${b.name}</b><div class="sub">${b.slug}</div>` }, { h: "Visible", f: (b) => yn(b.active) }, { h: "Order", f: (b) => b.sortOrder }],
  form: (b) => { b = b || { active: true, sortOrder: 0 }; return { html: html`<div class="form-grid">${field("Brand name", "name", b.name)}${field("Sort order", "sortOrder", b.sortOrder, { type: "number" })}${field("Description", "description", b.description, { type: "textarea", full: true })}<div class="field full"><label>Logo (optional)</label><div id="logo"></div></div></div>${field("Visible in store", "active", b.active, { type: "checkbox" })}`, setup: () => ({ img: imageUploader($("#logo"), b.logo ? [{ url: b.logo, thumb: b.logo }] : [], { folder: "brands", max: 1 }) }) }; },
  read: (f, x) => { const d = readForm(f); return { name: d.name, description: d.description, sortOrder: d.sortOrder ?? 0, active: d.active, logo: x.img.get()[0]?.url || "" }; },
}));

/* ---------------- coupons ---------------- */
register("coupons", async (view) => {
  const cats = (await api("/categories", { query: { limit: 200 } })).items;
  return crudPage(view, {
    title: "Coupons and discounts", noun: "coupon", addLabel: "Add coupon", path: "/coupons", wide: true,
    cols: [{ h: "Code", f: (c) => html`<b>${c.code}</b><div class="sub">${c.description || ""}</div>` }, { h: "Discount", f: (c) => (c.type === "percent" ? `${c.value}%${c.maxDiscount ? ` (max ${naira(c.maxDiscount)})` : ""}` : naira(c.value)) }, { h: "Min. spend", f: (c) => (c.minSubtotal ? naira(c.minSubtotal) : "—") }, { h: "Used", f: (c) => `${c.usedCount}${c.usageLimit ? " / " + c.usageLimit : ""}` }, { h: "Valid until", f: (c) => (c.expiresAt ? dshort(c.expiresAt) : "No expiry") }, { h: "Active", f: (c) => yn(c.active) }],
    form: (c) => { c = c || { type: "percent", active: true, minSubtotal: 0, perUserLimit: 1, categories: [] }; return { html: html`<div class="form-grid">${field("Code", "code", c.code, { ph: "WELCOME10", hint: "Letters and numbers. Customers type this at checkout." })}${field("Description (internal)", "description", c.description)}
      ${field("Type", "type", c.type, { type: "select", options: [["percent", "Percentage off"], ["fixed", "Fixed amount off (₦)"]] })}${field("Value", "value", c.value, { type: "number", hint: "A percentage (e.g. 10) or an amount in naira." })}${field("Maximum discount (₦)", "maxDiscount", c.maxDiscount ?? "", { type: "number", hint: "Cap for percentage coupons. Optional." })}${field("Minimum spend (₦)", "minSubtotal", c.minSubtotal, { type: "number" })}
      ${field("Starts", "startsAt", dInput(c.startsAt), { type: "date" })}${field("Expires", "expiresAt", dInput(c.expiresAt), { type: "date" })}${field("Total uses allowed", "usageLimit", c.usageLimit ?? "", { type: "number", hint: "Leave empty for unlimited." })}${field("Uses per customer", "perUserLimit", c.perUserLimit ?? "", { type: "number" })}</div>
      <div class="field"><label>Only applies to these categories (leave all unticked for the whole cart)</label><div class="state-grid">${cats.map((x) => html`<label class="check"><input type="checkbox" name="_cat" value="${x._id}" ${(c.categories || []).map(String).includes(x._id) ? "checked" : ""}> ${x.parent ? "— " : ""}${x.name}</label>`)}</div></div>${field("Active", "active", c.active, { type: "checkbox" })}` }; },
    read: (f) => { const d = readForm(f); return { code: d.code, description: d.description, type: d.type, value: d.value, maxDiscount: num(d.maxDiscount), minSubtotal: d.minSubtotal ?? 0, startsAt: d.startsAt || null, expiresAt: d.expiresAt || null, usageLimit: num(d.usageLimit), perUserLimit: num(d.perUserLimit), categories: $$("[name=_cat]:checked", f).map((x) => x.value), active: d.active }; },
  });
});

/* ---------------- delivery zones ---------------- */
register("delivery", async (view) => {
  const M_COLS = [{ k: "code", label: "Code", ph: "standard", w: "90px" }, { k: "name", label: "Name", ph: "Standard delivery", w: "150px" }, { k: "fee", label: "Fee (₦)", type: "number", w: "90px" }, { k: "freeOver", label: "Free over (₦)", type: "number", ph: "optional", w: "100px" }, { k: "etaMinDays", label: "Min days", type: "number", w: "70px" }, { k: "etaMaxDays", label: "Max days", type: "number", w: "70px" }];
  const states = (await get("/config")).states;
  return crudPage(view, {
    title: "Delivery zones and fees", noun: "delivery zone", addLabel: "Add zone", path: "/delivery-zones", wide: true, search: false,
    intro: "Group states into zones and set the delivery fee for each. A state can belong to only one active zone, and customers can only order to states that are in an active zone. Zones that are inactive are ignored.",
    cols: [{ h: "Zone", f: (z) => html`<b>${z.name}</b>` }, { h: "States", f: (z) => html`<span class="small">${z.states.join(", ")}</span>` }, { h: "Methods", f: (z) => z.methods.map((m) => `${m.name}: ${m.fee ? naira(m.fee) : "Free"}`).join(" · ") }, { h: "Active", f: (z) => yn(z.active) }],
    form: (z) => { z = z || { states: [], methods: [{ code: "standard", name: "Standard delivery", fee: 0 }], active: true, sortOrder: 0 }; const mr = repeater("methods", M_COLS, z.methods, { addLabel: "Add delivery method" });
      return { html: html`<div class="form-grid">${field("Zone name", "name", z.name, { ph: "Lagos Mainland" })}${field("Sort order", "sortOrder", z.sortOrder, { type: "number" })}</div>
      <div class="field"><label>States in this zone</label><div class="state-grid">${states.map((s) => html`<label class="check"><input type="checkbox" name="_st" value="${s}" ${z.states.includes(s) ? "checked" : ""}> ${s}</label>`)}</div></div>
      <h3>Delivery methods</h3>${mr.html}<div style="margin-top:16px">${field("Zone is active", "active", z.active, { type: "checkbox" })}</div>`, defs: { methods: mr } }; },
    read: (f) => { const d = readForm(f); return { name: d.name, sortOrder: d.sortOrder ?? 0, active: d.active, states: $$("[name=_st]:checked", f).map((x) => x.value), methods: readRepeater(f, "methods", M_COLS).filter((m) => m.code).map((m) => ({ ...m, fee: m.fee ?? 0, freeOver: m.freeOver ?? null })) }; },
  });
});

/* ---------------- banners & testimonials ---------------- */
register("banners", (view) => crudPage(view, {
  title: "Homepage banners", noun: "banner", addLabel: "Add banner", path: "/banners", search: false, wide: true,
  intro: "“Hero” banners rotate at the top of the homepage. “Promo” banners appear as two cards further down. Upload an image, or leave it empty to use the default device artwork.",
  cols: [{ h: "Banner", f: (b) => html`<b>${b.title}</b><div class="sub">${b.subtitle}</div>` }, { h: "Where", f: (b) => b.placement }, { h: "Link", f: (b) => b.ctaLink }, { h: "Active", f: (b) => yn(b.active) }],
  form: (b) => { b = b || { placement: "hero", theme: "blue", ctaText: "Shop now", ctaLink: "/shop", active: true, sortOrder: 0 }; return { html: html`<div class="form-grid">${field("Headline", "title", b.title, { full: true })}${field("Supporting text", "subtitle", b.subtitle, { full: true })}${field("Button text", "ctaText", b.ctaText)}${field("Button link", "ctaLink", b.ctaLink, { hint: "e.g. /category/phones or /shop?onOffer=1" })}${field("Where", "placement", b.placement, { type: "select", options: [["hero", "Hero (top of homepage)"], ["promo", "Promo card"]] })}${field("Colour", "theme", b.theme, { type: "select", options: [["blue", "Cobalt blue"], ["ink", "Dark navy"], ["light", "Light grey"], ["volt", "Amber"]] })}${field("Show from", "startsAt", dInput(b.startsAt), { type: "date" })}${field("Show until", "endsAt", dInput(b.endsAt), { type: "date" })}${field("Order", "sortOrder", b.sortOrder, { type: "number" })}<div class="field full"><label>Image (optional)</label><div id="bimg"></div></div></div>${field("Active", "active", b.active, { type: "checkbox" })}`, setup: () => ({ img: imageUploader($("#bimg"), b.image ? [{ url: b.image, thumb: b.image }] : [], { folder: "banners", max: 1 }) }) }; },
  read: (f, x) => { const d = readForm(f); return { placement: d.placement, title: d.title, subtitle: d.subtitle, ctaText: d.ctaText, ctaLink: d.ctaLink, theme: d.theme, startsAt: d.startsAt || null, endsAt: d.endsAt || null, sortOrder: d.sortOrder ?? 0, active: d.active, image: x.img.get()[0]?.url || "" }; },
}));

register("testimonials", (view) => crudPage(view, {
  title: "Testimonials", noun: "testimonial", addLabel: "Add testimonial", path: "/testimonials",
  intro: "Only add real feedback from real customers (with their permission). If you add none, the homepage shows recent approved 4–5 star product reviews instead.",
  cols: [{ h: "Customer", f: (t) => html`<b>${t.name}</b><div class="sub">${t.location}</div>` }, { h: "Feedback", f: (t) => html`<span class="small">${t.text.slice(0, 90)}${t.text.length > 90 ? "…" : ""}</span>` }, { h: "Sample", f: (t) => (t.sample ? html`<span class="tag tag-low">Sample</span>` : "") }, { h: "Active", f: (t) => yn(t.active) }],
  form: (t) => { t = t || { rating: 5, active: true, sortOrder: 0, sample: false }; return { html: html`<div class="form-grid">${field("Customer name", "name", t.name)}${field("Location", "location", t.location, { ph: "Lagos" })}${field("What they said", "text", t.text, { type: "textarea", full: true, rows: 4 })}${field("Rating (1-5)", "rating", t.rating, { type: "number" })}${field("Order", "sortOrder", t.sortOrder, { type: "number" })}</div><div class="checks">${field("Active", "active", t.active, { type: "checkbox" })}${field("This is placeholder text", "sample", t.sample, { type: "checkbox" })}</div>` }; },
  read: (f) => { const d = readForm(f); return { name: d.name, location: d.location, text: d.text, rating: d.rating ?? 5, sortOrder: d.sortOrder ?? 0, active: d.active, sample: d.sample }; },
}));

/* ---------------- reviews ---------------- */
register("reviews", async (view) => {
  let status = "pending", page = 1;
  view.innerHTML = html`<div class="a-head"><h1>Reviews</h1></div><div class="tabs-a" id="rtabs">${[["pending", "Awaiting approval"], ["approved", "Approved"], ["rejected", "Rejected"]].map(([k, l]) => html`<button data-s="${k}" aria-pressed="${k === status}">${l}</button>`)}</div><div id="list"></div>`.toString();
  const load = async () => {
    const r = await api("/reviews", { query: { status, page } });
    $("#list").innerHTML = html`${table([{ h: "Review", f: (v) => html`<div class="stars" aria-label="${v.rating} stars">${"★".repeat(v.rating)}</div> <b>${v.title || ""}</b><div class="small">${v.body}</div><div class="sub">${v.authorName} · ${dt(v.createdAt)} ${v.verifiedPurchase ? "· Verified purchase" : ""}</div>` }, { h: "Product", f: (v) => v.product?.name || "(deleted)" },
      { h: "", r: true, f: (v) => html`${v.status !== "approved" ? html`<button class="btn btn-primary btn-sm" data-set="approved" data-id="${v._id}">Approve</button> ` : ""}${v.status !== "rejected" ? html`<button class="btn btn-ghost btn-sm" data-set="rejected" data-id="${v._id}">Reject</button> ` : ""}<button class="btn btn-danger btn-sm" data-del="${v._id}" aria-label="Delete">${icon("trash")}</button>` }], r.items, { empty: "No reviews here." })}${pager(r.page, r.pages)}`.toString();
  };
  view.onclick = async (e) => {
    const s = e.target.closest("[data-s]"); if (s) { status = s.dataset.s; page = 1; $$("#rtabs button").forEach((b) => b.setAttribute("aria-pressed", b === s)); return load(); }
    const pg = e.target.closest("[data-pg]"); if (pg) { page = Number(pg.dataset.pg); return load(); }
    const st = e.target.closest("[data-set]"); if (st) { await api(`/reviews/${st.dataset.id}`, { method: "PATCH", body: { status: st.dataset.set } }); toast("Review updated"); return load(); }
    const d = e.target.closest("[data-del]"); if (d && (await confirmDialog("Delete this review?", "Delete"))) { await api(`/reviews/${d.dataset.del}`, { method: "DELETE" }); load(); }
  };
  load();
});

/* ---------------- enquiries ---------------- */
register("enquiries", async (view) => {
  let status = "", page = 1, items = [];
  view.innerHTML = html`<div class="a-head"><h1>Customer enquiries</h1></div><div class="tabs-a" id="etabs">${[["", "All"], ["new", "New"], ["in_progress", "In progress"], ["resolved", "Resolved"]].map(([k, l]) => html`<button data-s="${k}" aria-pressed="${k === status}">${l}</button>`)}</div><div id="list"></div>`.toString();
  const load = async () => {
    const r = await api("/enquiries", { query: { status, page } }); items = r.items;
    $("#list").innerHTML = html`${table([{ h: "From", f: (e) => html`<b>${e.name}</b><div class="sub">${e.email}${e.phone ? " · " + e.phone : ""}</div>` }, { h: "Message", f: (e) => html`<b>${e.subject || ""}</b><div class="small">${e.message.slice(0, 120)}${e.message.length > 120 ? "…" : ""}</div>` }, { h: "Received", f: (e) => dt(e.createdAt) }, { h: "Status", f: (e) => html`<span class="tag ${e.status === "new" ? "tag-hot" : e.status === "resolved" ? "tag-ok" : ""}">${e.status.replace("_", " ")}</span>` }, { h: "", r: true, f: (e) => html`<button class="btn btn-ghost btn-sm" data-open="${e._id}">Open</button>` }], items, { empty: "No enquiries." })}${pager(r.page, r.pages)}`.toString();
  };
  view.onclick = (e) => {
    const s = e.target.closest("[data-s]"); if (s) { status = s.dataset.s; page = 1; $$("#etabs button").forEach((b) => b.setAttribute("aria-pressed", b === s)); return load(); }
    const pg = e.target.closest("[data-pg]"); if (pg) { page = Number(pg.dataset.pg); return load(); }
    const o = e.target.closest("[data-open]");
    if (o) { const q = items.find((x) => x._id === o.dataset.open); const m = modal({ title: q.subject || "Enquiry", body: html`<p><b>${q.name}</b> · <a href="mailto:${q.email}">${q.email}</a>${q.phone ? html` · <a href="tel:${q.phone}">${q.phone}</a>` : ""}<br><span class="muted small">${dt(q.createdAt)}</span></p><p style="white-space:pre-wrap">${q.message}</p><form><div class="field"><label>Status</label><select class="select" name="status">${["new", "in_progress", "resolved"].map((s) => html`<option value="${s}" ${q.status === s ? "selected" : ""}>${s.replace("_", " ")}</option>`)}</select></div><div class="field"><label>Internal note</label><textarea class="textarea" name="adminNote">${q.adminNote || ""}</textarea></div><button class="btn btn-primary" type="submit">Save</button></form>` });
      const f = m.el.querySelector("form"); f.onsubmit = async (ev) => { ev.preventDefault(); await api(`/enquiries/${q._id}`, { method: "PATCH", body: { status: f.status.value, adminNote: f.adminNote.value } }); m.close(); toast("Saved"); load(); }; }
  };
  load();
});

/* ---------------- subscribers ---------------- */
register("subscribers", async (view) => {
  let page = 1, q = "";
  view.innerHTML = html`<div class="a-head"><h1>Newsletter subscribers</h1><a class="btn btn-ghost" href="${apiUrl("/api/admin/subscribers/export.csv")}">Export active (CSV)</a></div><div class="filters-row"><input class="input grow" id="q" type="search" placeholder="Search email"></div><div id="list"></div>`.toString();
  const load = async () => { const r = await api("/subscribers", { query: { page, q } }); $("#list").innerHTML = html`${table([{ h: "Email", f: (s) => s.email }, { h: "Subscribed", f: (s) => dt(s.createdAt) }, { h: "Status", f: (s) => (s.active ? html`<span class="tag tag-ok">Active</span>` : html`<span class="tag">Unsubscribed</span>`) }, { h: "", r: true, f: (s) => html`<button class="btn btn-danger btn-sm" data-del="${s._id}" aria-label="Delete">${icon("trash")}</button>` }], r.items, { empty: "No subscribers yet." })}<p class="muted small">${r.total} total</p>${pager(r.page, r.pages)}`.toString(); };
  let t; $("#q").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; page = 1; load(); }, 300); };
  view.onclick = async (e) => { const pg = e.target.closest("[data-pg]"); if (pg) { page = Number(pg.dataset.pg); load(); } const d = e.target.closest("[data-del]"); if (d && (await confirmDialog("Remove this subscriber?", "Remove"))) { await api(`/subscribers/${d.dataset.del}`, { method: "DELETE" }); load(); } };
  load();
});

/* ---------------- customers ---------------- */
register("customers", async (view, parts) => {
  if (parts[0]) {
    const { customer: c, orders } = await api(`/customers/${parts[0]}`);
    view.innerHTML = html`<div class="a-head"><div><a href="#/customers" class="small">← Customers</a><h1>${c.name}</h1></div>${can("customers") && c.role === "customer" ? html`<button class="btn ${c.status === "active" ? "btn-danger" : "btn-primary"}" id="toggle">${c.status === "active" ? "Suspend account" : "Reactivate account"}</button>` : ""}</div>
    <div class="a-grid"><div class="card-a"><h2>Order history</h2>${table([{ h: "Order", f: (o) => html`<a href="#/orders/${o.reference}"><b>${o.reference}</b></a>` }, { h: "Date", f: (o) => dt(o.createdAt) }, { h: "Status", f: (o) => html`<span class="status-pill st-${o.status}">${o.status.replace("_", " ")}</span>` }, { h: "Total", r: true, f: (o) => naira(o.total) }], orders, { empty: "No orders yet." })}</div>
    <div class="card-a"><h2>Profile</h2><p style="margin:0">${c.email}<br>${c.phone || "No phone"}<br><span class="muted small">Joined ${dshort(c.createdAt)}${c.lastLoginAt ? " · last seen " + dshort(c.lastLoginAt) : ""}</span></p><p>Status: <span class="tag ${c.status === "active" ? "tag-ok" : "tag-out"}">${c.status}</span></p>${c.addresses?.length ? html`<hr class="divider"><b>Saved addresses</b>${c.addresses.map((a) => html`<p class="small" style="margin:8px 0">${a.label}: ${a.address}, ${a.city}, ${a.state}</p>`)}` : ""}</div></div>`.toString();
    $("#toggle")?.addEventListener("click", async () => { if (await confirmDialog(c.status === "active" ? "Suspend this account? They will be signed out and unable to sign in." : "Reactivate this account?", "Yes")) { await api(`/customers/${c.id}`, { method: "PATCH", body: { status: c.status === "active" ? "suspended" : "active" } }); toast("Account updated"); location.reload(); } });
    return;
  }
  let page = 1, q = "";
  view.innerHTML = html`<div class="a-head"><h1>Customers</h1></div><div class="filters-row"><input class="input grow" id="q" type="search" placeholder="Search name, email or phone"></div><div id="list"></div>`.toString();
  const load = async () => { const r = await api("/customers", { query: { page, q } }); $("#list").innerHTML = html`${table([{ h: "Customer", f: (c) => html`<a class="name" href="#/customers/${c.id}">${c.name}</a><div class="sub">${c.email}</div>` }, { h: "Phone", f: (c) => c.phone || "—" }, { h: "Orders", f: (c) => c.orders }, { h: "Spent", f: (c) => naira(c.spent) }, { h: "Joined", f: (c) => dshort(c.createdAt) }, { h: "Status", f: (c) => html`<span class="tag ${c.status === "active" ? "tag-ok" : "tag-out"}">${c.status}</span>` }], r.customers, { empty: "No customers yet." })}<p class="muted small">${r.total} customers</p>${pager(r.page, r.pages)}`.toString(); };
  let t; $("#q").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; page = 1; load(); }, 300); };
  view.onclick = (e) => { const pg = e.target.closest("[data-pg]"); if (pg) { page = Number(pg.dataset.pg); load(); } };
  load();
});

/* ---------------- staff ---------------- */
register("staff", async (view) => {
  const load = async () => {
    const { staff } = await api("/customers/staff/list");
    view.innerHTML = html`<div class="a-head"><h1>Staff accounts</h1><button class="btn btn-primary" id="add">${icon("plus")} Add staff member</button></div>
    <p class="muted" style="max-width:720px"><b>Administrator:</b> everything. <b>Manager:</b> products, orders, coupons, content and reports. <b>Support:</b> view and update orders, reply to enquiries, moderate reviews.</p>
    ${table([{ h: "Name", f: (s) => html`<b>${s.name}</b><div class="sub">${s.email}</div>` }, { h: "Role", f: (s) => html`<select class="select" data-role="${s.id}" style="min-height:36px;padding:4px 30px 4px 10px" ${s.id === ctx.user.id ? "disabled" : ""}>${["support", "manager", "admin"].map((r) => html`<option ${s.role === r ? "selected" : ""}>${r}</option>`)}</select>` }, { h: "Last sign-in", f: (s) => (s.lastLoginAt ? dt(s.lastLoginAt) : "Never") }, { h: "Status", f: (s) => html`<span class="tag ${s.status === "active" ? "tag-ok" : "tag-out"}">${s.status}</span>` }, { h: "", r: true, f: (s) => (s.id === ctx.user.id ? html`<span class="muted small">You</span>` : html`<button class="btn btn-ghost btn-sm" data-toggle="${s.id}" data-to="${s.status === "active" ? "suspended" : "active"}">${s.status === "active" ? "Suspend" : "Reactivate"}</button>`) }], staff)}`.toString();
    $("#add").onclick = () => {
      const m = modal({ title: "Add staff member", body: html`<form novalidate><div class="field"><label>Full name</label><input class="input" name="name"></div><div class="field"><label>Email</label><input class="input" name="email" type="email"></div><div class="field"><label>Temporary password</label><input class="input" name="password" type="text" autocomplete="off"><div class="hint">At least 8 characters with a letter and a number. Ask them to change it after signing in.</div></div><div class="field"><label>Role</label><select class="select" name="role"><option>support</option><option>manager</option><option>admin</option></select></div><button class="btn btn-primary btn-block" type="submit">Create account</button></form>` });
      const f = m.el.querySelector("form"); f.onsubmit = async (e) => { e.preventDefault(); clearAlert(f); await withLoading(f.querySelector("button"), async () => { try { await api("/customers/staff", { method: "POST", body: { name: f.name.value, email: f.email.value, password: f.password.value, role: f.role.value } }); m.close(); toast("Staff member added"); load(); } catch (err) { if (!showFieldErrors(f, err.fields)) formAlert(f, err.message); } }); };
    };
    view.onchange = async (e) => { const r = e.target.closest("[data-role]"); if (r) { try { await api(`/customers/staff/${r.dataset.role}`, { method: "PATCH", body: { role: r.value } }); toast("Role updated"); } catch (err) { toast(err.message, "err"); load(); } } };
    view.onclick = async (e) => { const t = e.target.closest("[data-toggle]"); if (t) { try { await api(`/customers/staff/${t.dataset.toggle}`, { method: "PATCH", body: { status: t.dataset.to } }); toast("Updated"); load(); } catch (err) { toast(err.message, "err"); } } };
  };
  load();
});

/* ---------------- content pages ---------------- */
register("pages", async (view) => {
  const { items } = await api("/pages");
  view.innerHTML = html`<div class="a-head"><h1>Content pages</h1></div><p class="muted" style="max-width:720px">Edit the text of About, FAQ and the policy pages. You can use <code>{{store}}</code>, <code>{{email}}</code>, <code>{{phone}}</code> and <code>{{returnDays}}</code> and they are filled in from Settings. Review the default policies with your own business rules before launch.</p>
  ${table([{ h: "Page", f: (p) => html`<b>${p.title}</b><div class="sub">/${p.slug === "about" || p.slug === "faq" || p.slug === "terms" ? p.slug : p.slug}</div>` }, { h: "Updated", f: (p) => dt(p.updatedAt) }, { h: "", r: true, f: (p) => html`<button class="btn btn-ghost btn-sm" data-edit="${p.slug}">Edit</button> <a class="btn btn-ghost btn-sm" target="_blank" href="/${p.slug}">View ↗</a>` }], items)}`.toString();
  view.onclick = async (e) => {
    const b = e.target.closest("[data-edit]"); if (!b) return;
    const { item } = await api(`/pages/${b.dataset.edit}`);
    const m = modal({ title: `Edit: ${item.title}`, body: html`<form novalidate><div class="field"><label>Title</label><input class="input" name="title" value="${item.title}"></div><div class="field"><label>Content</label><textarea class="textarea" name="body" style="min-height:360px;font-family:monospace;font-size:.88rem">${item.body}</textarea><div class="hint">Use # for headings, ## for sub-headings, - for bullet points, **bold**, and [text](/link). In the FAQ page each ## heading becomes a question.</div></div><button class="btn btn-primary" type="submit">Save page</button></form>` });
    m.el.querySelector(".modal").classList.add("wide");
    const f = m.el.querySelector("form"); f.onsubmit = async (ev) => { ev.preventDefault(); await withLoading(f.querySelector("button"), async () => { try { await api(`/pages/${item.slug}`, { method: "PUT", body: { title: f.title.value, body: f.body.value } }); m.close(); toast("Page saved"); } catch (err) { formAlert(f, err.message); } }); };
  };
});

/* ---------------- reports ---------------- */
register("reports", async (view) => {
  const today = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  view.innerHTML = html`<div class="a-head"><h1>Sales reports</h1></div><div class="filters-row"><label>From <input class="input" type="date" id="from" value="${start}"></label><label>To <input class="input" type="date" id="to" value="${today}"></label><select class="select" id="group"><option value="day">By day</option><option value="month">By month</option></select><a class="btn btn-ghost" id="csv" href="#">Download CSV</a></div><div id="out"></div>`.toString();
  const params = () => ({ from: $("#from").value, to: $("#to").value, groupBy: $("#group").value });
  const load = async () => {
    const r = await api("/reports/sales", { query: params() });
    $("#out").innerHTML = html`<div class="kpis"><div class="kpi"><div class="l">Revenue</div><div class="v">${naira(r.totals.revenue)}</div></div><div class="kpi"><div class="l">Paid orders</div><div class="v">${r.totals.orders}</div></div><div class="kpi"><div class="l">Units sold</div><div class="v">${r.totals.units}</div></div><div class="kpi"><div class="l">Discounts given</div><div class="v">${naira(r.totals.discount)}</div></div></div>
    ${r.rows.length ? html`<div class="card-a" style="margin-bottom:20px"><h2>Revenue</h2>${barChart(r.rows.map((x) => ({ ...x, date: x.period })), "revenue")}</div>${table([{ h: "Period", f: (x) => x.period }, { h: "Orders", f: (x) => x.orders }, { h: "Units", f: (x) => x.units }, { h: "Subtotal", r: true, f: (x) => naira(x.subtotal) }, { h: "Discounts", r: true, f: (x) => naira(x.discount) }, { h: "Delivery", r: true, f: (x) => naira(x.delivery) }, { h: "Revenue", r: true, f: (x) => html`<b>${naira(x.revenue)}</b>` }], r.rows)}` : html`<div class="card-a empty">No paid orders in this period.</div>`}`.toString();
  };
  for (const id of ["from", "to", "group"]) $("#" + id).onchange = load;
  $("#csv").onclick = (e) => { e.preventDefault(); location.href = apiUrl("/api/admin/reports/sales") + "?" + new URLSearchParams({ ...params(), format: "csv" }); };
  load();
});
