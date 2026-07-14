import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getPublicTryOnConfig } from "../tryon-config.server";

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const requestedShop = new URL(request.url).searchParams.get("shop") || "";
  const shop = session?.shop || requestedShop;
  const requestedLocale = new URL(request.url).searchParams.get("locale");
  const locale = requestedLocale?.toLowerCase().split("-")[0] === "ar" ? "ar" : "en";

  if (!SHOP_DOMAIN.test(shop)) {
    return Response.json({ error: "Invalid shop" }, { status: 400 });
  }

  const config = await getPublicTryOnConfig(shop.toLowerCase(), locale);
  return Response.json(config, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};
