import KnowledgeScreen from '@/components/knowledge/knowledge-screen';

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <KnowledgeScreen locale={locale} />;
}
