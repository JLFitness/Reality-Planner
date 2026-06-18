// Small shared building blocks. Big tap targets, dark theme, consistent rounding.
import { useState } from 'react';

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/70 ${className}`}>
      {children}
    </div>
  );
}

// A card with a heading. Pass `collapsible` to add a chevron that hides the body.
// Pass a `persistKey` so the open/closed choice survives navigating away and back.
export function Panel({
  title,
  subtitle,
  children,
  className = '',
  collapsible = false,
  defaultOpen = true,
  persistKey,
}) {
  const [open, setOpen] = useState(() => {
    if (!collapsible) return true;
    if (persistKey) {
      try {
        const v = localStorage.getItem(`panel:${persistKey}`);
        if (v !== null) return v === '1';
      } catch {
        /* ignore */
      }
    }
    return defaultOpen;
  });
  const isOpen = !collapsible || open;

  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      if (persistKey) {
        try {
          localStorage.setItem(`panel:${persistKey}`, next ? '1' : '0');
        } catch {
          /* ignore */
        }
      }
      return next;
    });

  return (
    <Card className={`p-4 ${className}`}>
      {(title || subtitle) &&
        (collapsible ? (
          <button onClick={toggle} className="flex w-full items-center justify-between gap-2 text-left">
            <span>
              {title && <span className="block font-semibold">{title}</span>}
              {subtitle && <span className="mt-0.5 block text-xs text-slate-400">{subtitle}</span>}
            </span>
            <span className="text-lg leading-none text-slate-500">{isOpen ? '▾' : '▸'}</span>
          </button>
        ) : (
          <div className="mb-3">
            {title && <h2 className="font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
        ))}
      {isOpen && <div className={collapsible ? 'mt-3' : ''}>{children}</div>}
    </Card>
  );
}

const BTN = {
  default: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
  primary: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  danger: 'bg-rose-600/80 hover:bg-rose-600 text-white',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-300',
};

export function Btn({ children, variant = 'default', className = '', ...rest }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition active:scale-[.98] disabled:opacity-40 ${BTN[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// Small square icon button (used for +/- reorder, delete).
export function IconBtn({ children, className = '', ...rest }) {
  return (
    <button
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-slate-700 active:scale-95 disabled:opacity-30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

const FIELD =
  'w-full min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none';

export function TextInput({ className = '', ...rest }) {
  return <input className={`${FIELD} ${className}`} {...rest} />;
}

export function NumberInput({ className = '', ...rest }) {
  return <input type="number" inputMode="decimal" className={`${FIELD} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select className={`${FIELD} appearance-none ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Label({ children }) {
  return <span className="mb-1 block text-xs font-medium text-slate-400">{children}</span>;
}

export function Pill({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function Empty({ children }) {
  return <p className="py-2 text-center text-sm text-slate-500">{children}</p>;
}

// Bottom-sheet on mobile, centered dialog on desktop. Click backdrop to close.
export function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{title}</h2>
            <IconBtn aria-label="Close" onClick={onClose} className="h-9 w-9">
              ✕
            </IconBtn>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
