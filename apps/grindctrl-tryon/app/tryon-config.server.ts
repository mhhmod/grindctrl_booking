export type PublicTryOnConfig = {
  buttonLabel: string;
  accentBg: string;
  accentFg: string;
  radiusPx: number;
  widgetTheme: "light" | "dark";
};

export const DEFAULT_TRYON_CONFIG: PublicTryOnConfig = {
  buttonLabel: "Try it on with AI",
  accentBg: "#2a2826",
  accentFg: "#f0ede9",
  radiusPx: 999,
  widgetTheme: "light",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const TRUSTED_PRODUCTION_ORIGINS = new Set(["https://grindctrl.cloud"]);

function resolveConfigBaseUrl() {
  const configured = process.env.GRINDCTRL_WEB_URL || "https://grindctrl.cloud";
  const url = new URL(configured);
  const isBareOrigin =
    url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
  const isTrustedProductionOrigin = TRUSTED_PRODUCTION_ORIGINS.has(url.origin);
  const isLocalDevelopmentOrigin =
    process.env.NODE_ENV !== "production" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]");

  if (!isBareOrigin || (!isTrustedProductionOrigin && !isLocalDevelopmentOrigin)) {
    throw new Error(
      "GRINDCTRL_WEB_URL must be the trusted https://grindctrl.cloud origin" +
        " (localhost is allowed only outside production).",
    );
  }

  return url.origin;
}

const CONFIG_BASE_URL = resolveConfigBaseUrl();

function asPublicConfig(value: unknown): PublicTryOnConfig | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.buttonLabel !== "string" ||
    candidate.buttonLabel.length === 0 ||
    candidate.buttonLabel.length > 100 ||
    typeof candidate.accentBg !== "string" ||
    !HEX_COLOR.test(candidate.accentBg) ||
    typeof candidate.accentFg !== "string" ||
    !HEX_COLOR.test(candidate.accentFg) ||
    typeof candidate.radiusPx !== "number" ||
    !Number.isFinite(candidate.radiusPx) ||
    candidate.radiusPx < 0 ||
    candidate.radiusPx > 999 ||
    (candidate.widgetTheme !== "light" && candidate.widgetTheme !== "dark")
  ) {
    return null;
  }

  return {
    buttonLabel: candidate.buttonLabel,
    accentBg: candidate.accentBg,
    accentFg: candidate.accentFg,
    radiusPx: candidate.radiusPx,
    widgetTheme: candidate.widgetTheme,
  };
}

function getConfigEndpoint(shop: string, locale: "en" | "ar") {
  const endpoint = new URL("/api/try-on/config", CONFIG_BASE_URL);
  endpoint.searchParams.set("shop", shop);
  endpoint.searchParams.set("locale", locale);
  return endpoint;
}

/**
 * Temporary server-side repository for storefront-safe appearance config.
 * The existing web app remains the source until this Shopify app receives its
 * own confirmed Supabase bindings.
 */
export async function getPublicTryOnConfig(
  shop: string,
  locale: "en" | "ar",
): Promise<PublicTryOnConfig> {
  try {
    const response = await fetch(getConfigEndpoint(shop, locale), {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) return DEFAULT_TRYON_CONFIG;
    return asPublicConfig(await response.json()) || DEFAULT_TRYON_CONFIG;
  } catch (error) {
    console.warn("Unable to load GrindCTRL try-on config; using defaults.", error);
    return DEFAULT_TRYON_CONFIG;
  }
}
