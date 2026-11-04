# WooCommerce and WordPress privacy requests

Shopify stores get privacy webhooks. WordPress stores use WordPress's own tools, and the GRINDCTRL Store Chat plugin plugs into them.

## Export and erase

A store admin opens Tools, then Export Personal Data or Erase Personal Data, and enters the shopper's email address. "GRINDCTRL Store Chat" is one of the sources WordPress asks.

The match is on this site only, and on the email the shopper gave: a verified login email, the contact address typed in the chat, or the email stored on the chat visitor.

Exported (WordPress builds the download):

- Chat conversations: start time, status, last page, the full message transcript (visitor, assistant, team), rating and comment, and questions the assistant could not answer.
- Attachment metadata: file type, size and date. The image files are not included in the export.
- Contact details: name and email stored on the visitor, and any lead captured with that email.

Erased (10 conversations per request step, WordPress repeats until done):

- The matching conversations with their messages, attachments (database rows and the stored image files), ratings, unanswered-question records and events.
- Leads with that email, and visitor records left with no conversation.

Not covered, because nothing links it to an email address: try-on sessions are keyed by an anonymous session id. Billing and credit records are not shopper data and are kept.

If GRINDCTRL cannot be reached, the plugin returns an error and WordPress shows the request as failed so it can be retried. It never reports "no data" for a failed lookup. A site that was never connected has no GRINDCTRL records, so it answers with an empty result.

Image files that cannot be removed immediately are queued and removed by the scheduled retention job.

## Uninstall

When the plugin is deleted, it tells GRINDCTRL with reason `uninstall`. The site's shopper data is redacted 48 hours later, which leaves time to reinstall. Pairing the site again within that time cancels the redaction. Deactivating the plugin only disconnects the site; it does not schedule redaction.

Redaction removes every conversation, message, attachment (including stored files), lead, visitor, feedback record, event and unanswered-question record for that site, plus try-on result images for that site. The merchant's own Store Chat settings, the connection record and billing evidence stay.

Older plugin versions (0.2.0) do not send a reason, so removing one of them disconnects the site without scheduling redaction. Chat data then follows the normal retention rule: deleted after twelve months without activity.

## Technical notes

- Routes: `POST /api/woo/privacy/export` and `POST /api/woo/privacy/erase`, signed like the heartbeat, rate limited per site, with the email never logged (a salted hash is).
- Redaction runs inside `POST /api/internal/shopify/retention` (the existing scheduled job), through `woo_site_redact`, in bounded batches. It re-checks the due condition under a row lock, so a re-paired site is never redacted.
- SQL: `supabase/20261105_woo_privacy.sql`.
