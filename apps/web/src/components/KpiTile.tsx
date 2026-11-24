export function KpiTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
