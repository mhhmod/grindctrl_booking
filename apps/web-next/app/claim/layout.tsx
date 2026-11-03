import { MantineUiProvider } from '@/components/mantine/provider';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';

/* /claim is a merchant SaaS surface: its message page and error boundary are
   built from Mantine, so the provider is mounted here and not on the
   marketing site. */
export default async function ClaimLayout({ children }: { children: React.ReactNode }) {
  return <MantineUiProvider dir={getDir(await getRequestLocale())}>{children}</MantineUiProvider>;
}
