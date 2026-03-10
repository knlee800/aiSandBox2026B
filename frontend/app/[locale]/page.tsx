import PublicLandingSlice from '@/components/public/public-landing-slice';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PublicLandingSlice locale={locale} />;
}
