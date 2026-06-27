'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

interface ServiceView {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
  active: boolean;
}

const EMPTY = { name: '', description: '', price: '', durationMinutes: '30' };

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceView[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<ServiceView[]>('/services').then(setServices).catch(() => setServices([]));
  }, []);

  useEffect(load, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const priceCents = Math.round(Number(form.price.replace(',', '.')) * 100);
      await api.post('/services', {
        name: form.name,
        description: form.description || undefined,
        priceCents: Number.isFinite(priceCents) ? priceCents : 0,
        durationMinutes: Number(form.durationMinutes),
      });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar serviço');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    try {
      await api.del(`/services/${id}`);
      load();
    } catch {
      /* mantém a lista; erro silencioso é aceitável aqui */
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-4 text-lg font-semibold">Catálogo de serviços</h1>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Serviço</th>
                <th className="px-4 py-2 font-medium">Preço</th>
                <th className="px-4 py-2 font-medium">Duração</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-slate-100 last:border-0 ${
                    s.active ? '' : 'opacity-50'
                  }`}
                >
                  <td className="px-4 py-2">
                    {s.name}
                    {!s.active && <span className="ml-2 text-xs text-slate-400">(inativo)</span>}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{brl(s.priceCents)}</td>
                  <td className="px-4 py-2 text-slate-500">{s.durationMinutes} min</td>
                  <td className="px-4 py-2 text-right">
                    {s.active && (
                      <Button variant="ghost" onClick={() => deactivate(s.id)}>
                        Desativar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Nenhum serviço cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Novo serviço</h2>
        <Card>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input label="Nome" value={form.name} onChange={set('name')} required />
            <Input label="Descrição" value={form.description} onChange={set('description')} />
            <Input
              label="Preço (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={set('price')}
              required
            />
            <Input
              label="Duração (min)"
              type="number"
              step="5"
              min="5"
              value={form.durationMinutes}
              onChange={set('durationMinutes')}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Salvando…' : 'Cadastrar'}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
