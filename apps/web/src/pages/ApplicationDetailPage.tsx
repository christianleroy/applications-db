import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApplicationForm } from '../components/ApplicationForm';
import { StatusBadge } from '../components/StatusBadge';
import { StatusTimeline } from '../components/StatusTimeline';
import { ClientError } from '../data/client';
import { useApplication, useDeleteApplication } from '../data/hooks';

const isHttpUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

function BackLink() {
  return (
    <Link to="/applications" className="text-blue-700 underline">
      Back to applications
    </Link>
  );
}

function ConfirmDelete({ company, busy, error, onConfirm, onCancel }: { company: string; busy: boolean; error: string | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" className="w-full max-w-md rounded bg-white p-5 shadow-lg">
        <h2 id="confirm-delete-title" className="text-lg font-semibold">
          Delete application
        </h2>
        <p className="mt-2 text-sm text-slate-700">Delete the application to {company}? This can't be undone.</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-slate-300 px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={onConfirm} className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-60">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: app, error, isPending } = useApplication(id);
  const remove = useDeleteApplication();
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (isPending) return <p className="text-slate-600">Loading...</p>;
  if (!app) {
    const notFound = error instanceof ClientError && error.status === 404;
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{notFound ? 'Application not found' : 'Could not load the application'}</h1>
        <BackLink />
      </div>
    );
  }

  async function confirmDelete() {
    setDeleteError(null);
    try {
      await remove.mutateAsync(id);
      navigate('/applications');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the application');
    }
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">
          {app.company} <span className="font-normal text-slate-600">- {app.role}</span>
        </h1>
        <StatusBadge status={app.status} />
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="ml-auto rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
        >
          Delete application
        </button>
      </header>

      {app.postingUrl && (
        <p className="text-sm">
          {isHttpUrl(app.postingUrl) ? (
            <a href={app.postingUrl} target="_blank" rel="noopener noreferrer" className="break-all text-blue-700 underline">
              {app.postingUrl}
            </a>
          ) : (
            <span className="break-all">{app.postingUrl}</span>
          )}
        </p>
      )}

      <section aria-label="Details" className="space-y-2">
        {saved && (
          <p role="status" className="rounded bg-green-50 px-3 py-2 text-sm text-green-800">
            Saved
          </p>
        )}
        <ApplicationForm key={app.id} initial={app} onSaved={() => setSaved(true)} onEdit={() => setSaved(false)} />
      </section>

      <StatusTimeline application={app} onChanged={() => setSaved(false)} />

      {confirming && (
        <ConfirmDelete
          company={app.company}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => {
            setConfirming(false);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}
