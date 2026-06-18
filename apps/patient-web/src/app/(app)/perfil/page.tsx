'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

const EMPTY = { name: '', cpf: '', birthDate: '', phone: '', email: '' };

export default function PerfilPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [hasProfile, setHasProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ name: string }>('/patients/me')
      .then(() => setHasProfile(true))
      .catch(() => setHasProfile(false));
  }, []);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/patients/me', {
        name: form.name,
        cpf: form.cpf,
        birthDate: form.birthDate,
        phone: form.phone,
        email: form.email || undefined,
      });
      router.replace('/agendar');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar cadastro');
    } finally {
      setBusy(false);
    }
  }

  if (hasProfile) {
    return (
      <Card>
        <p className="text-sm text-slate-600">Seu cadastro já está completo.</p>
        <Button className="mt-4" onClick={() => router.replace('/agendar')}>
          Ir para agendamento
        </Button>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-lg font-semibold">Complete seu cadastro</h1>
      <p className="mb-4 text-sm text-slate-500">Precisamos destes dados para agendar consultas.</p>
      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input label="Nome completo" value={form.name} onChange={set('name')} required />
          <Input label="CPF" value={form.cpf} onChange={set('cpf')} required />
          <Input
            label="Data de nascimento"
            type="date"
            value={form.birthDate}
            onChange={set('birthDate')}
            required
          />
          <Input label="Telefone" value={form.phone} onChange={set('phone')} required />
          <Input label="E-mail (confirmações)" type="email" value={form.email} onChange={set('email')} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar e continuar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
