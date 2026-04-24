import React from 'react';
import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <AuthShell
        title="Create your workspace"
        subtitle="Set up your GRINDCTRL access to manage install safety, intents, and lead capture at production quality."
        footerPrompt="Already have an account?"
        footerCtaLabel="Sign in"
        footerCtaHref="/sign-in"
      >
        <Alert>
          <AlertTitle>Clerk environment variables are missing</AlertTitle>
          <AlertDescription>
            Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local` to render the sign-up flow.
          </AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Set up your GRINDCTRL access to manage install safety, intents, and lead capture at production quality."
      footerPrompt="Already have an account?"
      footerCtaLabel="Sign in"
      footerCtaHref="/sign-in"
    >
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard/overview" />
    </AuthShell>
  );
}
