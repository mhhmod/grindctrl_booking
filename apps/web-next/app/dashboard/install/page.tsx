import { redirect } from 'next/navigation';

/* This route used to render a design mock: hardcoded badges, a disabled
   "Start conversation (Preview only)" button, a "Domain verification concept"
   note, a placeholder site key (`gc_your_site_key_here`), and a script URL —
   https://grindctrl.cloud/scripts/grindctrl-support.js — that returns 404 in
   production. It is not in the dashboard nav, so nobody navigated to it on
   purpose; the OAuth callback simply dropped merchants here, and they were
   handed installation instructions for a widget that does not exist.

   The real installation surface is the Store Chat Installation tab, which
   serves this store's actual embed key and the loader that is actually
   deployed. Sending people there rather than deleting the route keeps old
   bookmarks and the /sites, /branding, /domains and /widget redirects that
   land here from turning into 404s. */

export default function DashboardInstallPage() {
  redirect('/dashboard/messenger?tab=installation');
}
