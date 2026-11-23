import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  todayIso,
  type ApplicationQuery,
  type CreateApplicationInput,
  type DateRange,
  type StatusEntryInput,
  type StatusEntryPatch,
  type UpdateApplicationInput,
} from '@applications-db/shared';
import { useClient } from './ClientProvider';

export function useApplications(q: ApplicationQuery) {
  const client = useClient();
  return useQuery({
    queryKey: ['applications', q],
    queryFn: () => client.list(q),
  });
}

export function useApplication(id: string) {
  const client = useClient();
  return useQuery({
    queryKey: ['application', id],
    queryFn: () => client.get(id),
  });
}

export function useDashboard() {
  const client = useClient();
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => client.dashboard(todayIso()),
  });
}

export function useStatistics() {
  const client = useClient();
  return useQuery({
    queryKey: ['statistics'],
    queryFn: () => client.statistics(),
  });
}

export function useReport(range: DateRange) {
  const client = useClient();
  return useQuery({
    queryKey: ['report', range],
    queryFn: () => client.report(range),
  });
}

const INVALIDATED_KEYS = ['applications', 'application', 'dashboard', 'statistics', 'report'] as const;

function useInvalidatingMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(INVALIDATED_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  });
}

export function useCreateApplication() {
  const client = useClient();
  return useInvalidatingMutation((input: CreateApplicationInput) => client.create(input));
}

export function useUpdateApplication() {
  const client = useClient();
  return useInvalidatingMutation((v: { id: string; patch: UpdateApplicationInput }) => client.update(v.id, v.patch));
}

export function useDeleteApplication() {
  const client = useClient();
  return useInvalidatingMutation((id: string) => client.remove(id));
}

export function useAddStatus() {
  const client = useClient();
  return useInvalidatingMutation((v: { id: string; input: StatusEntryInput }) => client.addStatus(v.id, v.input));
}

export function useUpdateStatus() {
  const client = useClient();
  return useInvalidatingMutation((v: { id: string; entryId: string; patch: StatusEntryPatch }) =>
    client.updateStatus(v.id, v.entryId, v.patch),
  );
}

export function useRemoveStatus() {
  const client = useClient();
  return useInvalidatingMutation((v: { id: string; entryId: string }) => client.removeStatus(v.id, v.entryId));
}
