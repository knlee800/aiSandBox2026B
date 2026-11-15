import SchedulesScreen from '@/components/schedules/schedules-screen';

export default async function SchedulesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <SchedulesScreen locale={locale} />;
}
