export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] p-8 text-center sm:p-12">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
