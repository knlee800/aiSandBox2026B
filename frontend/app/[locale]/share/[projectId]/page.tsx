'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  forkPublicWorkspaceProject,
  loadPublicWorkspaceProjectDetail,
  type WorkspacePublicProjectDetail,
} from '@/components/workspace/workspace-projects.logic';

export default function PublicShareDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const projectId = params.projectId as string;
  const [detail, setDetail] = useState<WorkspacePublicProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const result = await loadPublicWorkspaceProjectDetail({ projectId });
        setDetail(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error && loadError.message.trim()
            ? loadError.message
            : 'Failed to load public project.',
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [projectId]);

  async function handleFork(): Promise<void> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push(`/${locale}/login`);
      return;
    }
    setForking(true);
    setError(null);
    setMessage(null);
    try {
      await forkPublicWorkspaceProject({ token, projectId });
      setMessage('Fork created in your private project list.');
    } catch (forkError) {
      setError(
        forkError instanceof Error && forkError.message.trim()
          ? forkError.message
          : 'Failed to fork project.',
      );
    } finally {
      setForking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-3xl rounded border border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Public Project View</h1>
        <p className="mt-1 text-sm text-gray-600">Read-only public detail page.</p>
        {loading ? <p className="mt-4 text-sm text-gray-500">Loading...</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {detail ? (
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-900">{detail.name}</p>
            <p className="text-xs text-gray-500">ID: {detail.id}</p>
            <p className="text-xs text-gray-500">Visibility: {detail.visibility}</p>
            <p className="text-xs text-gray-500">Mode: read-only</p>
          </div>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void handleFork()}
            disabled={forking || loading || !detail}
            className="rounded bg-emerald-600 px-3 py-1 text-xs text-white disabled:bg-emerald-300"
          >
            {forking ? 'Forking...' : 'Fork this project'}
          </button>
          <Link
            href={`/${locale}/share`}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
          >
            Back to browse
          </Link>
        </div>
        {message ? <p className="mt-3 text-xs text-emerald-700">{message}</p> : null}
      </div>
    </div>
  );
}
