import { Card } from '@/components/ui/card';

export function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="gap-2 px-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
    </Card>
  );
}
