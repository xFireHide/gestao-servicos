'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';

const NAV = [
  { href: '/agendar', label: 'Agendar' },
  { href: '/minhas-consultas', label: 'Minhas consultas' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Se o paciente ainda não completou o cadastro clínico, direciona para /perfil.
  useEffect(() => {
    if (loading || !user) return;
    api
      .get('/patients/me')
      .then(() => setProfileChecked(true))
      .catch(() => {
        if (pathname !== '/perfil') router.replace('/perfil');
        else setProfileChecked(true);
      });
  }, [user, loading, pathname, router]);

  if (loading || !user || !profileChecked) {
    return <main className="grid min-h-screen place-items-center text-slate-500">Carregando…</main>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-brand-700">Minha Clínica</span>
            <nav className="flex gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    pathname === item.href
                      ? 'bg-brand-50 font-medium text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Button variant="ghost" onClick={logout}>
            Sair
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
