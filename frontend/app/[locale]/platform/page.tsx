import PlatformDashboard from '@/components/platform/platform-dashboard';

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <PlatformDashboard locale={locale} />;
}
