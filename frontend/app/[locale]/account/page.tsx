import { redirect } from 'next/navigation';
import ApiKeysPage from '../keys/page';
import { PROJECT_FIRST_UX } from '@/lib/feature-flags';
import LogoutButton from '@/components/auth/logout-button';

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!PROJECT_FIRST_UX) {
    redirect(`/${locale}/keys`);
  }

  return (
    <>
      <LogoutButton />
      <ApiKeysPage />
    </>
  );
}
