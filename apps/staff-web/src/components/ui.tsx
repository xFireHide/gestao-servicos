import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    ghost: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant];
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block text-sm">
      {label && <span className="mb-1 block font-medium text-slate-700">{label}</span>}
      <input
        className={`w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 ${className}`}
        {...props}
      />
    </label>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
