# Part 02 — evidence and implementation boundaries

Prepared 11 October 2026. This film proposes a new GRINDCTRL collaboration. It is an illustrative employee experience, not a live integration or a diagnosis of Concrete’s tenant.

| Classification | Evidence actually available | What the film can show | What remains unverified |
|---|---|---|---|
| Reported by customer | In this conversation: Genesys calls; Zoho Desk ticketing; manual phone-number search retrieves prior tickets; that context reportedly does not appear automatically during calls. | Current manual search versus the proposed contextual experience. | Actual tenant behavior, reproduction, configuration and cause. |
| Contracted | Concrete contract (29-11-2023).pdf, PDF p.4, visually reinspected for this production: exact scope **“CRM URL pop up integration”**. Static scripts and call routing are also scoped there. | Inspect the existing setup before proposing more infrastructure. | Whether the scoped feature is enabled, working, targeting Desk, or suitable for this use. |
| Other contracted context | September 2022 PDF p.7 scopes Zoho/Desk service functions; December 2022 p.3 amends Prism-related scope; November 2023 p.5 discusses retaining Prism integration with Desk/Creator. The 2025/2026 files concern renewal and commercial terms. Earlier full-page reading notes were reviewed. | Existing systems form the starting point. | Scope is not proof of present deployment, active CRM use, current branch count, API permissions or licensing. Financial terms are not included in this delivery. |
| Officially documented principle | [Genesys Client Apps SDK README](https://github.com/MyPureCloud/client-app-sdk/blob/master/README.md), retrieved and read. It describes app/UI navigation, attention and lifecycle integration, HTTPS/iframe requirements, and separate platform data access. Its example distinguishes standalone/widget display and warns that visibility groups alone do not provide authorization. | Supported mechanisms may exist in principle; inspect first and preserve proper permissions. | Concrete’s entitlement, configuration, display type, call-event availability and authorized data-access mechanism. The film does not install an app or assert an embedded sidebar. |
| Official SDK access | [Genesys Platform JavaScript SDK](https://github.com/MyPureCloud/platform-client-sdk-javascript/blob/master/README.md), retrieved; introduction and integration/data-access sections inspected. | An approved minimal adapter may be investigated if a real gap exists. | A specific suitable endpoint, access grant, customer-phone search contract, latency or successful integration. No fake endpoint is displayed. |
| Official UI research attempts | Genesys agent-workspace/help pages and the Genesys public product page were blocked. Zoho ticket/contact help URLs returned HTML shells but rendered no article text; the Zoho public product/API pages were blocked. | Clear illustrative interfaces with vendor identifiers and the reported workflow. | Current vendor-native screen geometry, fields, tab structure, edition and live Concrete UI. These pages were **not** treated as successfully researched articles. |
| Actually inspected tenant evidence | **None.** No authorized Concrete Genesys/Desk screenshots, credentials, API grants or tenant configuration were supplied or accessed. Repository demonstration code contains authored synthetic fixtures, not live tenant evidence. | No claimed live screenshots or operational connector. | All tenant-specific UI details. |
| Proposed behavior | Eight audio-led scenes: caller lookup, permitted context, T101, shared number selection, distinct fallbacks, implementation decision and authorized pilot. | The conservative proposed employee experience, subject to validation. | Final display surface, matching rules, access equivalence, verification process, availability behavior and commercial value. |
| Synthetic demonstration data | Contact A, Contact B, masked +20 ••• 410, T101, T098, Agent B/C. T101 status **Open**, latest note **Branch review is still pending.** | Same call and case throughout; no real customer records. | These are not Concrete records or verified fields. |

## Technical position

The first step is an authorized configuration review and test calls. Check the existing contracted URL pop-up target and behavior, exact Genesys setup and edition, available caller information, and the actual Zoho Desk lookup and permission model. Manual UI phone search does not prove an equivalent API search.

Use native supported configuration if it satisfies the required experience. Add the smallest approved adapter only for a verified gap. The adjacent conceptual windows show information together; they do not guarantee a native sidebar. A separate URL pop-up or tab may be the appropriate implementation.

Start with read-only retrieval. Call arrival does not create, close, reassign, refund or change ticket status. A phone-number association is not authentication. With multiple candidates, permitted information is reviewed and the employee selects only after the agreed verification process. Neither candidate’s ticket history is shown before that selection.

A successful lookup with no matching customer differs from an unavailable lookup. An outage must not be presented as “No Tickets Found.” The call continues in both cases. Manual Desk search is offered when supported/available; it is not guaranteed during a Desk outage. Retry is illustrated without a claim of successful execution.

## Public references attempted

- [Genesys agent workspace](https://help.mypurecloud.com/articles/agent-workspace-overview/) — proxy blocked.
- [Genesys alternate help host](https://help.genesys.cloud/articles/agent-workspace-overview/) — proxy blocked.
- [Zoho ticket detail](https://help.zoho.com/portal/en/kb/desk/ticket-management/articles/understanding-the-ticket-detail-page) — HTTP 200 shell; no rendered article content.
- [Zoho contact details](https://help.zoho.com/portal/en/kb/desk/contacts-and-accounts/articles/customer-module-the-contacts-and-accounts-detail-page) — HTTP 200 shell; no rendered article content.
- [Zoho ticketing product](https://www.zoho.com/desk/ticketing-system.html), [Zoho API reference](https://desk.zoho.com/DeskAPIDocument), [Genesys product reference](https://www.genesys.com/capabilities/agent-workspace) — proxy blocked.

Detailed source-access outcomes are preserved as JSON. Neither the SDK references nor public marketing material would establish Concrete-specific capability even if accessible. Contracts remain private source evidence; the delivery contains their relevant scope citation, not the documents or confidential prices.
