export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    if (process.env.TRYON_MODE?.toLowerCase() === 'live') {
      const { reportRetiredModelSettings } = await import('./lib/try-on/models');
      reportRetiredModelSettings();
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (
  ...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>
) => {
  const Sentry = await import('@sentry/nextjs');
  return Sentry.captureRequestError(...args);
};
