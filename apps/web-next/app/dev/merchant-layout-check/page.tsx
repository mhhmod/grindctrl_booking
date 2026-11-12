import { notFound } from 'next/navigation';
import { MerchantLayoutCheck } from './merchant-layout-check';

/** Auth-free layout proof using the shipping components and sample data only. */
export default async function Page({ searchParams }: {
  searchParams: Promise<{ locale?: string; page?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  return <MerchantLayoutCheck locale={params.locale === 'ar' ? 'ar' : 'en'} surface={params.page === 'team' ? 'team' : 'plan'} />;
}
