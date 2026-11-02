import React, { Suspense } from 'react';
import CollaborationPageClient, {
  CollaborationLoading,
} from '@/components/collaboration/collaboration-page';

export default function CollaborationPage() {
  return (
    <Suspense fallback={<CollaborationLoading />}>
      <CollaborationPageClient />
    </Suspense>
  );
}
