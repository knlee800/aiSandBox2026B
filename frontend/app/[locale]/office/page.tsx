import OfficeScreen from '@/components/office/office-screen';

export default async function OfficePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <OfficeScreen locale={locale} />;
}
