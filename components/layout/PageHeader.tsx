import { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6 pb-6 border-b border-slate-100">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-500 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
