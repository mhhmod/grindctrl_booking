'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

/* Next.js replaces the ENTIRE root layout with this when an error escapes
   the root layout itself, so it defines its own html/body and stays free
   of anything that could itself fail (locale resolution, Clerk, theme). */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
