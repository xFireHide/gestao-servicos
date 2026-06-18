'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/agendar' : '/login');
  }, [user, loading, router]);

  return <main className="grid min-h-screen place-items-center text-slate-500">Carregando…</main>;
}
