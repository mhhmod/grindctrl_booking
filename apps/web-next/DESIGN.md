# DESIGN.md

## Brand (grindctrl-owned surfaces: dashboard, landing, embedded admin chrome)
- Warm cream/charcoal identity: backgrounds oklch-warm near #faf8f5 (light) / #1b1917 (dark), charcoal ink #2a2826, warm muted #8a8378.
- Accent: warm orange-gold gradient (#ff9a3d → #ffd76e) used sparingly (icons, highlights), never full surfaces.
- Typography: single sans (Geist/Inter stack already in app). Weight contrast over size explosion.
- Components: shadcn/ui vocabulary (Card, Button, Input, Label). Radius: rounded-xl on interactive, rounded-lg containers.

## Widget (merchant-facing storefront surfaces)
- Colors come from merchant settings (accentBg/accentFg/iconBgFrom/iconBgTo/radiusPx/widgetTheme). Never hardcode grindctrl brand colors into shopper-facing UI.
- widgetTheme 'light'/'dark' sets the panel surface: light #faf8f5-family or dark #1b1917-family.
- Motion: 150-250ms ease-out for state; the try-on button icon runs a 4.2s loop (tee drop, sheen, sparkles), reduced-motion safe.
- CTA hierarchy on result: primary = merchant conversion (Add to cart), secondary = compact utility row (download/share), tertiary = ghost (try another photo), disclaimer smallest.

## Bans
- No em dashes in copy. No gradient text. No side-stripe borders. No nested cards.
