/* The marketing site (/, /pricing, /try-on): once a visitor is signed in,
   this is no longer "come chat with us about the product" territory — the
   dashboard is one click away and has its own assistant entry point via the
   same launcher. Kept as a prefix list, not a single regex, since / needs an
   exact match (startsWith('/') matches everything) while the others are
   whole subtrees. */
function isLandingFamily(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/pricing') || pathname.startsWith('/try-on');
}

/* /assistant already IS the launcher's destination (no point launching it
   from itself); /embed/* renders inside a third-party Shopify iframe, where
   an unrelated GrindCTRL-site assistant (and its sign-in CTA) has no place.
   middleware.ts deliberately never runs for /embed/* (its own matcher
   excludes it, to keep Clerk's cookie handshake out of that iframe context)
   — so x-pathname is never set there, and pathname arrives as null. Default
   to NOT showing when unknown: every intended page (/, /try-on, /dashboard,
   /assistant, /sign-in, ...) goes through middleware normally and gets the
   header, so only /embed/* and API routes (which don't render this layout's
   UI anyway) fall through to the null case. */
export function showLauncherFor(pathname: string | null, isLoggedIn: boolean): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/assistant') || pathname.startsWith('/embed')) return false;
  if (isLoggedIn && isLandingFamily(pathname)) return false;
  return true;
}
