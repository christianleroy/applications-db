import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CheckIcon, Trash2Icon } from 'lucide-react';
import { ApplicationForm } from '../components/ApplicationForm';
import { PageStatus } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { StatusTimeline } from '../components/StatusTimeline';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ClientError } from '../data/client';
import { useApplication, useDeleteApplication } from '../data/hooks';
import { errorMessage } from '../lib/errors';

const isHttpUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

function BackLink() {
  return (
    <Link
      to="/applications"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-4" />
      Back to applications
    </Link>
  );
}

type ConfirmDeleteProps = {
  company: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  trigger: ReactElement;
  open: boolean;
  onOpen: () => void;
};

function ConfirmDelete({ company, busy, error, onConfirm, onCancel, trigger, open, onOpen }: ConfirmDeleteProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? onOpen() : onCancel())}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete application</AlertDialogTitle>
          <AlertDialogDescription>Delete the application to {company}? This can't be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {/* A plain button, not AlertDialogAction: the dialog stays open until the delete succeeds or fails. */}
          <Button type="button" variant="destructive" disabled={busy} onClick={onConfirm}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  // Keyed on the id so per-application UI state (Saved banner, delete dialog) never carries over.
  return <ApplicationDetail key={id} id={id} />;
}

function ApplicationDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: app, error, isPending } = useApplication(id);
  const remove = useDeleteApplication();
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (isPending) return <PageStatus>Loading...</PageStatus>;
  if (!app) {
    const notFound = error instanceof ClientError && error.status === 404;
    return (
      <div className="space-y-3">
        <BackLink />
        <h1 className="text-2xl font-semibold tracking-tight">{notFound ? 'Application not found' : 'Could not load the application'}</h1>
      </div>
    );
  }

  async function confirmDelete() {
    setDeleteError(null);
    try {
      await remove.mutateAsync(id);
      navigate('/applications');
    } catch (err) {
      setDeleteError(errorMessage(err, 'Could not delete the application'));
    }
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {app.company} <span className="font-normal text-muted-foreground">- {app.role}</span>
            </h1>
            <StatusBadge status={app.status} />
          </div>
          {app.postingUrl && (
            <p className="text-sm">
              {isHttpUrl(app.postingUrl) ? (
                <a
                  href={app.postingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary underline underline-offset-4 hover:text-primary-hover"
                >
                  {app.postingUrl}
                </a>
              ) : (
                <span className="break-all text-muted-foreground">{app.postingUrl}</span>
              )}
            </p>
          )}
        </div>
        <ConfirmDelete
          company={app.company}
          busy={remove.isPending}
          error={deleteError}
          onConfirm={confirmDelete}
          open={confirming}
          onOpen={() => setConfirming(true)}
          onCancel={() => {
            setConfirming(false);
            setDeleteError(null);
          }}
          trigger={
            <Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive">
              <Trash2Icon aria-hidden="true" />
              Delete application
            </Button>
          }
        />
      </header>

      <section aria-label="Details" className="space-y-4 rounded-lg border bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">Details</h2>
        {saved && (
          <p role="status" className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckIcon aria-hidden="true" className="size-4" />
            Saved
          </p>
        )}
        <ApplicationForm key={app.id} initial={app} onSaved={() => setSaved(true)} onEdit={() => setSaved(false)} />
      </section>

      <StatusTimeline application={app} onChanged={() => setSaved(false)} />
    </div>
  );
}
