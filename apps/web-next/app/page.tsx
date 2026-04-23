import Link from 'next/link';
import { ArrowRight, Globe, LayoutDashboard, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-950">G</span>
            <span>GRINDCTRL</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/sign-in" className="rounded-full px-4 py-2 text-zinc-300 hover:text-white">
              Sign in
            </Link>
            <Link href="/dashboard" className="rounded-full bg-white px-4 py-2 font-medium text-zinc-950 hover:bg-zinc-200">
              Open dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <section>
            <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
              Dashboard integration in progress
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              GRINDCTRL dashboard foundations, now on Next.js.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              The UI shell now lives in this repo, uses real Clerk auth, reads the existing Supabase dashboard contracts, and keeps the public widget runtime separate.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/install" className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 font-medium text-zinc-950 hover:bg-zinc-200">
                Open install screen
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/sign-in" className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 font-medium text-zinc-100 hover:bg-zinc-800">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Sign in with Clerk
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-black/20">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-sm font-medium text-white">Install contract</p>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-xs leading-6 text-zinc-300">
{`<script>
  window.GrindctrlSupport = window.GrindctrlSupport || [];
  window.GrindctrlSupport.push({ embedKey: 'gc_live_xxxxx' });
</script>
<script async src="https://cdn.grindctrl.com/widget/v1/loader.js"></script>`}
              </pre>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <LayoutDashboard className="h-4 w-4" />
                    Real dashboard routes
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">Overview, install, branding, intents, domains, and leads now have dedicated routes.</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Globe className="h-4 w-4" />
                    Runtime preserved
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">The widget loader/runtime remains external to React and keeps the current production contract.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-5 py-8 text-sm text-zinc-500 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>GRINDCTRL dashboard integration shell</p>
          <div className="flex items-center gap-4">
            <Link href="/dashboard/overview" className="hover:text-zinc-300">Overview</Link>
            <Link href="/dashboard/install" className="hover:text-zinc-300">Install</Link>
            <Link href="/sign-in" className="hover:text-zinc-300">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
