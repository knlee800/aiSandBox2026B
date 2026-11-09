import ConnectionsScreen from '@/components/connections/connections-screen';

export default async function ConnectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ConnectionsScreen locale={locale} />;
}
