# Paste fixtures (plain script tag on any website)

Static product, listing and app pages that imitate common storefront markup,
for the pasted Try-On and Store Chat code (`public/widget/v1/messenger.js`,
`tryon-paste.js`, `tryon-engine.js`). `lib/paste/paste-fixtures.test.ts` loads
each one in jsdom and checks detection, placement and page following.

Each file says what it imitates in its first comment, and carries what the
test expects:

- `<meta name="gc-fixture-path">`: the address the page is served at.
- `<meta name="gc-fixture-expect">`: `after` (the button follows the element
  marked `data-gc-expect="after"`), `float`, `none`, or `cards:N`.

To look at one in a browser, serve this folder next to a running app
(`npm run dev` on port 3000) and replace `REPLACE_WITH_EMBED_KEY` with a
paste install's embed key. Looks still need the page origin and image host
to be one of that site's verified domains, or an official image server for
the platform fingerprinted by the server on that page's trusted domain.

`easyorders-like.html` follows the supplied live markup: identifier-free
Product JSON-LD, two static purchase wrappers, and an RTL Next.js-style SPA.
Its fixture controls switch products and open an onClick-only collection;
those cards deliberately have no pills until a server product-list adapter exists.
