import { notFound } from 'next/navigation';
import { MerchantLayoutCheck } from './merchant-layout-check';
import { SURFACES, type Surface } from './surface-list';

/** Auth-free layout proof using the shipping components and sample data only. */
export default async function Page({ searchParams }: {
  searchParams: Promise<{ locale?: string; page?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const surface = (SURFACES as readonly string[]).includes(params.page ?? '') ? params.page as Surface : 'plan';
  return <MerchantLayoutCheck locale={params.locale === 'ar' ? 'ar' : 'en'} surface={surface} />;
}
