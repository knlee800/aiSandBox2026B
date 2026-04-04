'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  loadPublicWorkspaceProjects,
  type WorkspacePublicProjectSummary,
} from '@/components/workspace/workspace-projects.logic';

export default function PublicShareBrowsePage() {
  const params = useParams();
  const locale = params.locale as string;
  const [projects, setProjects] = useState<WorkspacePublicProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const result = await loadPublicWorkspaceProjects();
        setProjects(result);
      } catch (loadError) {
        setError(
          loadError instanceof Error && loadError.message.trim()
            ? loadError.message
            : 'Failed to load public projects.',
        );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-4xl rounded border border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Public Project Browse</h1>
        <p className="mt-1 text-sm text-gray-600">
          Read-only list of publicly shared projects.
        </p>

        {loading ? <p className="mt-4 text-sm text-gray-500">Loading public projects...</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        {!loading && !error ? (
          <ul className="mt-4 space-y-2" data-testid="public-share-list">
            {projects.map((project) => (
              <li
                key={project.id}
                className="rounded border border-gray-200 bg-gray-50 p-3"
              >
                <p className="text-sm font-medium text-gray-900">{project.name}</p>
                <p className="text-xs text-gray-500">Visibility: {project.visibility}</p>
                <Link
                  href={`/${locale}/share/${project.id}`}
                  className="mt-2 inline-block text-xs font-medium text-blue-700 hover:text-blue-800"
                >
                  View read-only page
                </Link>
              </li>
            ))}
            {projects.length === 0 ? (
              <li className="text-sm text-gray-500">No public projects available yet.</li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
