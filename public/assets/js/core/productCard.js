import { html } from "./html.js";
import { icon } from "./icons.js";
import { naira } from "./format.js";
import { stars } from "./ui.js";
import { Wish } from "./state.js";
import { assetUrl } from "./api.js";

export function productCard(p) {
  const out = p.totalStock <= 0;
  const multi = p.variantCount > 1;
  const priceVaries = p.maxPrice > p.minPrice;
  return html`<article class="card ${out ? "is-out" : ""}" data-id="${p.id}">
    <a class="card-media" href="/p/${p.slug}" tabindex="-1" aria-hidden="true"><img src="${assetUrl(p.image)}" alt="" loading="lazy" width="400" height="400">
      <span class="card-tags">${out ? html`<span class="tag tag-out">Out of stock</span>` : ""}${!out && p.maxDiscountPct > 0 ? html`<span class="tag tag-sale">-${p.maxDiscountPct}%</span>` : ""}${!out && p.newArrival ? html`<span class="tag tag-new">New</span>` : ""}${!out && !p.newArrival && p.bestseller ? html`<span class="tag tag-hot">Best seller</span>` : ""}</span></a>
    <button class="wish ${Wish.has(p.id) ? "on" : ""}" data-wish="${p.id}" aria-label="${Wish.has(p.id) ? "Remove from wishlist" : "Add to wishlist"}" aria-pressed="${Wish.has(p.id)}">${icon("heart")}</button>
    <div class="card-body">
      <div class="card-brand">${p.brandName}</div>
      <a class="card-name" href="/p/${p.slug}">${p.name}</a>
      <div class="card-sum">${p.summary || "\u00a0"}</div>
      <div class="card-rating">${p.ratingCount ? html`${stars(p.ratingAvg)}<span>(${p.ratingCount})</span>` : html`<span>&nbsp;</span>`}</div>
      <div><span class="price">${priceVaries ? html`<span class="price-from">From</span>` : ""}${naira(p.minPrice)}</span></div>
      <div class="card-foot">${out
        ? html`<a class="btn btn-ghost btn-sm btn-block" href="/p/${p.slug}">View details</a>`
        : multi
        ? html`<a class="btn btn-ghost btn-sm btn-block" href="/p/${p.slug}">Choose options</a>`
        : html`<button class="btn btn-primary btn-sm btn-block" data-add="${p.id}" data-sku="${p.defaultSku}">${icon("cart")} Add to cart</button>`}</div>
    </div>
  </article>`;
}

export const skeletons = (n = 8) => html`${Array.from({ length: n }, () => html`<div class="skel skel-card"></div>`)}`;
