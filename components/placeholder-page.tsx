export function PlaceholderPage({
  title,
}: {
  title: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Module scaffold — full CRUD coming in next phase per build plan.
      </p>
    </div>
  );
}
