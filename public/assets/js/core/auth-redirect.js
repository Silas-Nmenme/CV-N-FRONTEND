const STOREFRONT_ORIGIN = "https://storefront.invalid";

export function postAuthPath(user, requestedPath = "") {
  const fallback = user?.isStaff ? "/admin" : "/account";
  if (typeof requestedPath !== "string" || !requestedPath.startsWith("/") ||
      requestedPath.startsWith("//") || requestedPath.includes("\\")) return fallback;

  let destination;
  try {
    destination = new URL(requestedPath, STOREFRONT_ORIGIN);
  } catch {
    return fallback;
  }
  if (destination.origin !== STOREFRONT_ORIGIN || /%(?:2f|5c)/i.test(destination.pathname)) return fallback;

  let pathname = destination.pathname;
  try {
    for (let i = 0; i < 3; i++) {
      const decoded = decodeURIComponent(pathname);
      if (decoded === pathname) break;
      pathname = decoded;
    }
  } catch {
    return fallback;
  }

  if (!user?.isStaff && /^\/admin(?:\/|$)/i.test(pathname)) return fallback;
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
