import ResultsScreen from '@/components/results/results-screen';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ResultsScreen locale={locale} />;
}
