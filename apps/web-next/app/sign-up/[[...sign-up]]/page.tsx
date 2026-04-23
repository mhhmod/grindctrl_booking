import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-sm text-zinc-400">Set Clerk environment variables to enable sign-up.</main>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard/overview" />
    </main>
  );
}
