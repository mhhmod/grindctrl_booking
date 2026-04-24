import React from 'react';
import { SignIn } from '@clerk/nextjs';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <AuthShell
        title="Welcome back"
        subtitle="Sign in to continue managing your widget rollout, site safety, and interaction telemetry."
        footerPrompt="Need an account?"
        footerCtaLabel="Create one"
        footerCtaHref="/sign-up"
      >
        <Alert>
          <AlertTitle>Clerk environment variables are missing</AlertTitle>
          <AlertDescription>
            Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in `.env.local` to render the sign-in flow.
          </AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue managing your widget rollout, site safety, and interaction telemetry."
      footerPrompt="Need an account?"
      footerCtaLabel="Create one"
      footerCtaHref="/sign-up"
    >
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard/overview" />
    </AuthShell>
  );
}
