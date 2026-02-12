'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    // Phase 37B: Redirect to unified product surface at /app
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.push(`/${locale}/app`);
    } else {
      router.push(`/${locale}/login`);
    }
  }, [router, locale]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Loading...</p>
    </div>
  );
}
