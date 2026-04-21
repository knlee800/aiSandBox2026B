import { redirect } from 'next/navigation';
import AppPage from '../app/page';
import { PROJECT_FIRST_UX } from '@/lib/feature-flags';

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!PROJECT_FIRST_UX) {
    redirect(`/${locale}/app`);
  }

  return <AppPage />;
}
