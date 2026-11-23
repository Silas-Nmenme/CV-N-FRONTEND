import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const port = Number(process.env.PORT || 5501);
const routes = new Map([
  ["/", "index.html"],
  ["/admin", "admin/index.html"],
  ["/shop", "shop.html"],
  ["/cart", "cart.html"],
  ["/checkout", "checkout.html"],
  ["/contact", "contact.html"],
  ["/account", "account.html"],
  ["/forgot-password", "forgot-password.html"],
  ["/login", "login.html"],
  ["/order", "order.html"],
  ["/payment-result", "payment-result.html"],
  ["/product", "product.html"],
  ["/receipt", "receipt.html"],
  ["/register", "register.html"],
  ["/reset-password", "reset-password.html"],
  ["/track-order", "track-order.html"],
  ["/unsubscribe", "unsubscribe.html"],
  ["/wishlist", "wishlist.html"],
]);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ message: "Configure API_BASE_URL to connect to the backend." }));
    return;
  }

  let relative = routes.get(pathname);
  if (!relative && (pathname.startsWith("/category/") || pathname.startsWith("/brand/"))) relative = "shop.html";
  if (!relative && pathname.startsWith("/p/")) relative = "product.html";
  if (!relative) {
    const candidate = path.resolve(root, `.${pathname}`);
    if (candidate === root || candidate.startsWith(root + path.sep)) {
      try {
        const info = await stat(candidate);
        relative = info.isFile() ? path.relative(root, candidate) : null;
      } catch {
        relative = null;
      }
    }
  }
  if (!relative && !path.extname(pathname)) relative = "content.html";
  if (!relative) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(await readFile(path.join(root, "404.html")));
    return;
  }

  try {
    const file = await readFile(path.join(root, relative));
    res.writeHead(200, { "Content-Type": types[path.extname(relative)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : file);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Frontend available at http://127.0.0.1:${port}`);
});
