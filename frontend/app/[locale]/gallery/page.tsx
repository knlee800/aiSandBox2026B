import { redirect } from 'next/navigation';
import PublicShareBrowsePage from '../share/page';
import { PROJECT_FIRST_UX } from '@/lib/feature-flags';

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!PROJECT_FIRST_UX) {
    redirect(`/${locale}/share`);
  }

  return <PublicShareBrowsePage />;
}
