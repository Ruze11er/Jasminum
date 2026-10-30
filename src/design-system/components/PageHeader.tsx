import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end gap-3 md:mb-7">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
