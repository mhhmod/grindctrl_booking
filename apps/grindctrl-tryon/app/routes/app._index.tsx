import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getSettingsForShop,
  saveSettingsForShop,
} from "../tryon-settings.server";

/* Theme-editor deep link that pre-adds the try-on block to the product
   template; the merchant only clicks Save. The block id is the app CLIENT
   ID + block filename (extension uid does not work here). */
const APP_CLIENT_ID = "fc095fe656d9029fdc249a4af2315f19";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop; // e.g. grindctrl.myshopify.com
  const settings = await getSettingsForShop(shop);

  return {
    shop,
    settings,
    deepLink: `https://${shop}/admin/themes/current/editor?template=product&addAppBlockId=${APP_CLIENT_ID}/tryon&target=mainSection`,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  const radius = Number(form.get("radiusPx"));
  const loadingStepsRaw = String(form.get("loadingSteps") || "").trim();

  const ok = await saveSettingsForShop(session.shop, {
    buttonLabel: String(form.get("buttonLabel") || "").trim() || undefined,
    accentBg: String(form.get("accentBg") || "").trim() || undefined,
    accentFg: String(form.get("accentFg") || "").trim() || undefined,
    radiusPx: Number.isFinite(radius)
      ? Math.max(0, Math.min(999, radius))
      : undefined,
    widgetTheme: form.get("widgetTheme") === "dark" ? "dark" : "light",
    loadingSteps: loadingStepsRaw
      ? loadingStepsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
      : null,
  });

  return { ok };
};

export default function Index() {
  const { settings, deepLink } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Try-on settings saved");
    } else if (fetcher.data && !fetcher.data.ok) {
      shopify.toast.show("Could not save settings", { isError: true });
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="GrindCTRL Try-On">
      <s-section heading="Add try-on to your product pages">
        <s-paragraph>
          One click opens your theme editor with the try-on block already
          placed on the product page. Just press Save there.
        </s-paragraph>
        <s-button href={deepLink} target="_blank" variant="primary">
          Add block to product page
        </s-button>
      </s-section>

      <s-section heading="Try-on button & journey">
        <s-paragraph>
          Controls how the try-on looks in your store. Changes go live within
          a minute. Your GrindCTRL team can also manage this for you.
        </s-paragraph>
        <fetcher.Form method="post">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Button label"
              name="buttonLabel"
              defaultValue={settings.buttonLabel}
              maxLength={40}
            />
            <s-stack direction="inline" gap="base">
              <s-color-field
                label="Button color"
                name="accentBg"
                defaultValue={settings.accentBg}
              />
              <s-color-field
                label="Button text color"
                name="accentFg"
                defaultValue={settings.accentFg}
              />
            </s-stack>
            <s-stack direction="inline" gap="base">
              <s-number-field
                label="Corner radius (px)"
                name="radiusPx"
                min={0}
                max={999}
                defaultValue={String(settings.radiusPx)}
              />
              <s-select
                label="Widget theme"
                name="widgetTheme"
                value={settings.widgetTheme}
              >
                <s-option value="light">Light</s-option>
                <s-option value="dark">Dark</s-option>
              </s-select>
            </s-stack>
            <s-text-area
              label="Loading steps (one per line, empty = default)"
              name="loadingSteps"
              rows={4}
              defaultValue={settings.loadingSteps?.join("\n") ?? ""}
            />
            <s-button
              type="submit"
              variant="primary"
              {...(isSaving ? { loading: true } : {})}
            >
              Save settings
            </s-button>
          </s-stack>
        </fetcher.Form>
      </s-section>

      <s-section slot="aside" heading="How it works">
        <s-unordered-list>
          <s-list-item>
            Customers tap the try-on button on a product page
          </s-list-item>
          <s-list-item>
            They upload one photo and AI renders them wearing the product
          </s-list-item>
          <s-list-item>
            Results and history live in your GrindCTRL dashboard
          </s-list-item>
        </s-unordered-list>
        <s-link href="https://grindctrl.cloud/dashboard/try-on" target="_blank">
          Open GrindCTRL dashboard
        </s-link>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
