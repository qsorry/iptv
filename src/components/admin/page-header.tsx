export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
      <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
      {action}
    </div>
  );
}
