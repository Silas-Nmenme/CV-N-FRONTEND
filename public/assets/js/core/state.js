import { get, post, put, del } from "./api.js";

const bus = new EventTarget();
export const on = (ev, fn) => bus.addEventListener(ev, (e) => fn(e.detail));
export const emit = (ev, detail) => bus.dispatchEvent(new CustomEvent(ev, { detail }));

const safeStorage = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
export const storage = safeStorage;

/* ------------------------------ config ------------------------------ */
let configPromise;
export const getConfig = () => (configPromise ||= get("/config").catch((e) => { configPromise = null; throw e; }));

/* ------------------------------ session ------------------------------ */
export const session = { user: null, ready: null };
export function loadSession() {
  session.ready ||= get("/auth/me").then((r) => (session.user = r.user)).catch(() => (session.user = null)).then(() => { emit("session", session.user); return session.user; });
  return session.ready;
}
export function setUser(u) { session.user = u; emit("session", u); }

/* -------------------------------- cart -------------------------------- */
const CART_KEY = "cvg_cart";
let cart = safeStorage.get(CART_KEY, []);
let syncTimer;
const persist = () => {
  safeStorage.set(CART_KEY, cart);
  emit("cart", cart);
  if (session.user) { clearTimeout(syncTimer); syncTimer = setTimeout(() => put("/account/cart", { items: cart }).catch(() => {}), 600); }
};
export const Cart = {
  items: () => cart.map((i) => ({ ...i })),
  count: () => cart.reduce((s, i) => s + i.quantity, 0),
  add(productId, sku, quantity = 1) {
    const line = cart.find((i) => i.productId === productId && i.sku === sku);
    if (line) line.quantity = Math.min(10, line.quantity + quantity); else cart.push({ productId, sku, quantity: Math.min(10, quantity) });
    persist();
  },
  setQty(productId, sku, quantity) {
    const line = cart.find((i) => i.productId === productId && i.sku === sku);
    if (!line) return;
    if (quantity <= 0) cart = cart.filter((i) => i !== line); else line.quantity = Math.min(10, quantity);
    persist();
  },
  remove(productId, sku) { cart = cart.filter((i) => !(i.productId === productId && i.sku === sku)); persist(); },
  clear() { cart = []; persist(); },
  replace(items) { cart = items; persist(); },
  /** On sign-in: merge guest cart with the saved cart and push the result to the server. */
  async mergeWithServer() {
    try {
      const r = await get("/account/cart");
      const merged = [...r.items];
      for (const g of cart) {
        const m = merged.find((i) => i.productId === g.productId && i.sku === g.sku);
        if (m) m.quantity = Math.max(m.quantity, g.quantity); else merged.push(g);
      }
      cart = merged;
      safeStorage.set(CART_KEY, cart);
      emit("cart", cart);
      await put("/account/cart", { items: cart });
    } catch { /* offline: keep local cart */ }
  },
};

/* ------------------------------ wishlist ------------------------------ */
const WISH_KEY = "cvg_wish";
let wish = new Set(safeStorage.get(WISH_KEY, []));
const saveWish = () => { safeStorage.set(WISH_KEY, [...wish]); emit("wish", [...wish]); };
export const Wish = {
  has: (id) => wish.has(id),
  count: () => wish.size,
  ids: () => [...wish],
  async toggle(id) {
    const adding = !wish.has(id);
    adding ? wish.add(id) : wish.delete(id);
    saveWish();
    if (session.user) { try { adding ? await post(`/account/wishlist/${id}`) : await del(`/account/wishlist/${id}`); } catch { /* keep optimistic */ } }
    return adding;
  },
  async mergeWithServer() {
    try {
      const r = await get("/account/wishlist");
      for (const id of r.ids) wish.add(id);
      await Promise.all([...wish].filter((id) => !r.ids.includes(id)).map((id) => post(`/account/wishlist/${id}`).catch(() => {})));
      saveWish();
    } catch { /* ignore */ }
  },
  reset() { wish = new Set(); saveWish(); },
};

/* ----------------------- guest order access tokens ----------------------- */
const TOK_KEY = "cvg_order_tokens";
export const OrderTokens = {
  save(ref, token) { const m = safeStorage.get(TOK_KEY, {}); m[ref] = token; const keys = Object.keys(m); if (keys.length > 20) delete m[keys[0]]; safeStorage.set(TOK_KEY, m); },
  get: (ref) => safeStorage.get(TOK_KEY, {})[ref],
};

export async function afterSignIn(user) {
  setUser(user);
  await Promise.all([Cart.mergeWithServer(), Wish.mergeWithServer()]);
}
