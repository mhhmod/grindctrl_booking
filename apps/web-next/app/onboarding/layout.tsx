import { MantineUiProvider } from '@/components/mantine/provider';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';

/* Onboarding is a merchant SaaS surface: its form is built from Mantine, so
   the provider is mounted here and not on the marketing site. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <MantineUiProvider dir={getDir(await getRequestLocale())}>{children}</MantineUiProvider>;
}
