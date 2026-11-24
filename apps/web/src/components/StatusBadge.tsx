import type { Status } from '@applications-db/shared';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS } from '../lib/labels';
import { STATUS_COLORS } from '../lib/statusColors';

export function StatusBadge({ status }: { status: Status }) {
  return <Badge className={STATUS_COLORS[status].badgeClass}>{STATUS_LABELS[status]}</Badge>;
}
