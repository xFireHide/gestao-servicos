'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
      // Após cadastrar a conta, o paciente completa o perfil clínico.
      router.replace('/perfil');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cadastrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Criar conta</h1>
        <p className="mb-6 text-sm text-slate-500">Agende consultas online</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Nome" value={form.name} onChange={set('name')} required minLength={2} />
          <Input label="E-mail" type="email" value={form.email} onChange={set('email')} required />
          <Input
            label="Senha"
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={8}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Criando…' : 'Criar conta'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{' '}
          <Link href="/login" className="font-medium text-brand-700">
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
