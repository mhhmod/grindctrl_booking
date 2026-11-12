import { redirect } from 'next/navigation';

/* An old alias for sign-in. Its query (redirect_url above all) goes along
   unchanged: the sign-in page is what validates it. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === 'string') query.append(key, item);
    }
  }
  const search = query.toString();
  redirect(search ? `/sign-in?${search}` : '/sign-in');
}
