'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AuthTokens } from '@clinica/shared';
import { api, ApiError, setTokens } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

const BUSINESS_TYPES: { value: string; label: string }[] = [
  { value: 'CLINIC', label: 'Clínica / consultório' },
  { value: 'SALON', label: 'Salão / estética' },
  { value: 'GYM', label: 'Academia / estúdio' },
  { value: 'WORKSHOP', label: 'Oficina / serviços' },
  { value: 'CONSULTING', label: 'Consultoria' },
  { value: 'GENERIC', label: 'Outro' },
];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '') // remove acentos/combining (mantém só ASCII)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export default function SignupPage() {
  const [form, setForm] = useState({
    organizationName: '',
    slug: '',
    businessType: 'GENERIC',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function onName(e: React.ChangeEvent<HTMLInputElement>) {
    const organizationName = e.target.value;
    setForm((f) => ({ ...f, organizationName, slug: slugTouched ? f.slug : slugify(organizationName) }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tokens = await api.post<AuthTokens>('/onboarding', form);
      setTokens(tokens);
      // Recarrega para o AuthProvider hidratar a sessão a partir do token.
      window.location.href = '/relatorios';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar a empresa');
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md">
        <h1 className="mb-1 text-xl font-semibold">Criar conta da empresa</h1>
        <p className="mb-6 text-sm text-slate-500">14 dias de teste no plano PRO, sem cartão.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input label="Nome da empresa" value={form.organizationName} onChange={onName} required />
          <Input
            label="Identificador (URL)"
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set('slug')(e);
            }}
            required
          />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Ramo</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              value={form.businessType}
              onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
            >
              {BUSINESS_TYPES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <hr className="border-slate-100" />
          <Input label="Seu nome" value={form.adminName} onChange={set('adminName')} required />
          <Input label="Seu e-mail" type="email" value={form.adminEmail} onChange={set('adminEmail')} required />
          <Input
            label="Senha"
            type="password"
            value={form.adminPassword}
            onChange={set('adminPassword')}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Criando…' : 'Criar empresa'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{' '}
          <Link href="/login" className="text-brand-700 hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
