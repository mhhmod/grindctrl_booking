=== GRINDCTRL Store Chat ===
Contributors: grindctrl
Tags: chat, woocommerce, customer support, live chat
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Adds GRINDCTRL Store Chat to your site, with the product a shopper is viewing on WooCommerce product pages.

== Description ==

GRINDCTRL Store Chat answers shoppers in English and Arabic and hands a chat to your team when it needs a person.

This plugin only loads the chat. You need a GRINDCTRL account to use it:

1. In the GRINDCTRL dashboard, open Store Chat and copy your embed key.
2. In the same place, add your site's domain and publish the DNS record it shows. Store Chat only answers on a verified domain.
3. In WordPress, open Settings, then GRINDCTRL Store Chat, and paste the key.

On WooCommerce product pages the chat can show the product and option the shopper picked, and, when your Store Chat rules ask for it, read the shopper's cart from your store's own Store API in their browser.

AI Virtual Try-On is not part of this plugin.

== External services ==

This plugin loads a script from grindctrl.cloud, the GRINDCTRL service that runs the chat.

* On every page where the chat is shown, the visitor's browser loads https://grindctrl.cloud/widget/v1/messenger.js and sends the page address and your embed key to GRINDCTRL to load your chat settings.
* When a visitor opens the chat, the messages they write, the page they are on, an anonymous visitor id and, on WooCommerce pages, the product they are viewing and a summary of their cart are sent to GRINDCTRL to answer them.

GRINDCTRL terms: https://grindctrl.cloud/terms
GRINDCTRL privacy policy: https://grindctrl.cloud/privacy

== Privacy ==

The plugin stores only its two settings in your WordPress database (the embed key and where the chat is shown). It stores no visitor data in WordPress, so it adds no personal data exporter or eraser. Chat conversations are kept by GRINDCTRL and managed from the GRINDCTRL dashboard. The plugin adds suggested text to your site's privacy policy guide.

== Frequently Asked Questions ==

= The chat does not appear =

Check that the embed key is saved, that this domain shows as Verified in the GRINDCTRL dashboard, and that Store Chat is turned on there.

= Does it slow my pages down? =

The script loads asynchronously in the footer, and the chat window only loads when a shopper shows interest in it.

== Changelog ==

= 0.1.0 =
* First version: settings page, chat loader, WooCommerce product and cart context.
