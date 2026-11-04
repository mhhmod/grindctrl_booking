=== GRINDCTRL Store Chat ===
Contributors: grindctrl
Tags: chat, woocommerce, customer support, live chat
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Adds GRINDCTRL Store Chat to your site, with the product a shopper is viewing on WooCommerce product pages.

== Description ==

GRINDCTRL Store Chat answers shoppers in English and Arabic and hands a chat to your team when it needs a person.

This plugin loads the chat and keeps your site connected to your GRINDCTRL account. You need a GRINDCTRL account to use it:

1. In the GRINDCTRL dashboard, open Store Chat, then Set up, and choose Get a connection code. The code works once and expires after 15 minutes.
2. In WordPress, open Settings, then GRINDCTRL Store Chat, paste the code and choose Connect.
3. In the dashboard, add your site's domain and publish the DNS record it shows. Store Chat only answers on a verified domain.

Once connected, the plugin sends a short daily check-in so the dashboard can show that the plugin is installed and up to date. Choosing Disconnect, deactivating the plugin or deleting it tells GRINDCTRL the site is gone.

On WooCommerce product pages the chat can show the product and option the shopper picked, and, when your Store Chat rules ask for it, read the shopper's cart from your store's own Store API in their browser.

AI Virtual Try-On is not part of this plugin.

== External services ==

This plugin loads a script from grindctrl.cloud, the GRINDCTRL service that runs the chat.

* When you connect the site, the plugin sends the connection code you entered, this site's home URL, the WordPress, WooCommerce and plugin versions, the site timezone and the store currency to https://grindctrl.cloud/api/woo/pair. GRINDCTRL answers with the identifiers and the signing secret this site uses from then on.
* About once a day while connected, and once when you disconnect, deactivate or delete the plugin, the plugin sends the same site details (no visitor or customer data) to https://grindctrl.cloud/api/woo/heartbeat or https://grindctrl.cloud/api/woo/disconnect. These requests are signed with the site's secret, which is never shown on a page or sent to a visitor's browser.
* On every page where the chat is shown, the visitor's browser loads https://grindctrl.cloud/widget/v1/messenger.js and sends the page address and your embed key to GRINDCTRL to load your chat settings.
* When a visitor opens the chat, the messages they write, the page they are on, an anonymous visitor id and, on WooCommerce pages, the product they are viewing and a summary of their cart are sent to GRINDCTRL to answer them.

GRINDCTRL terms: https://grindctrl.cloud/terms
GRINDCTRL privacy policy: https://grindctrl.cloud/privacy

== Privacy ==

The plugin stores its settings in your WordPress database: the embed key, where the chat is shown, and, once connected, the connection details (site id, a secret used to sign requests to GRINDCTRL, its version, the connection status and the last connection error). The secret is kept out of autoloaded options and is removed when you disconnect or delete the plugin. It stores no visitor data in WordPress, so it adds no personal data exporter or eraser. Chat conversations are kept by GRINDCTRL and managed from the GRINDCTRL dashboard. The plugin adds suggested text to your site's privacy policy guide.

== Frequently Asked Questions ==

= The chat does not appear =

Check that the site shows as Connected under Settings, then GRINDCTRL Store Chat, that this domain shows as Verified in the GRINDCTRL dashboard, and that Store Chat is turned on there.

= The connection code is not accepted =

Codes work once and expire after 15 minutes. Choose Get a connection code in the GRINDCTRL dashboard to make a new one.

= It says this server's clock is out of sync =

Signed requests are only accepted within five minutes of GRINDCTRL's time. Correct the clock on your server and connect again.

= Can I connect without a code? =

Under Advanced on the settings page you can enter the embed key by hand. The chat loads, but the dashboard will not show the site as connected.

= Does it slow my pages down? =

The script loads asynchronously in the footer, and the chat window only loads when a shopper shows interest in it.

== Changelog ==

= 0.2.0 =
* Connect the site with a one-time connection code from the GRINDCTRL dashboard.
* Signed daily check-in so the dashboard shows the plugin version and when it was last seen.
* Disconnect button. Deactivating or deleting the plugin tells GRINDCTRL the site is disconnected.
* The manual embed key moved under Advanced.

= 0.1.0 =
* First version: settings page, chat loader, WooCommerce product and cart context.
