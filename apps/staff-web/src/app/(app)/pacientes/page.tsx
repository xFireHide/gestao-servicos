'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

type Status = 'LEAD' | 'ACTIVE' | 'INACTIVE';

interface PatientView {
  id: string;
  name: string;
  cpf: string | null;
  phone: string;
  email: string | null;
  status: Status;
  tags: string[];
}

const EMPTY = {
  name: '',
  cpf: '',
  birthDate: '',
  phone: '',
  email: '',
  status: 'ACTIVE' as Status,
  source: '',
  tags: '',
};

const STATUS_LABEL: Record<Status, string> = { LEAD: 'Lead', ACTIVE: 'Ativo', INACTIVE: 'Inativo' };
const FILTERS: { value: Status | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'LEAD', label: 'Leads' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'INACTIVE', label: 'Inativos' },
];

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const q = filter === 'ALL' ? '' : `?status=${filter}`;
    api.get<PatientView[]>(`/patients${q}`).then(setPatients).catch(() => setPatients([]));
  }, [filter]);

  useEffect(load, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.post('/patients', {
        name: form.name,
        phone: form.phone,
        cpf: form.cpf || undefined,
        birthDate: form.birthDate || undefined,
        email: form.email || undefined,
        status: form.status,
        source: form.source || undefined,
        tags: tags.length ? tags : undefined,
      });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar cliente');
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Clientes</h1>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  filter === f.value
                    ? 'bg-brand-50 font-medium text-brand-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Telefone</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/pacientes/${p.id}`} className="text-brand-700 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{p.phone}</td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Nenhum cliente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Novo cliente / lead</h2>
        <Card>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input label="Nome" value={form.name} onChange={set('name')} required />
            <Input label="Telefone" value={form.phone} onChange={set('phone')} required />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Status</span>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
              >
                <option value="LEAD">Lead</option>
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </label>
            <Input label="Origem" value={form.source} onChange={set('source')} placeholder="Instagram, indicação…" />
            <Input label="Tags (vírgula)" value={form.tags} onChange={set('tags')} placeholder="vip, campanha" />
            <Input label="CPF (opcional)" value={form.cpf} onChange={set('cpf')} />
            <Input label="Nascimento (opcional)" type="date" value={form.birthDate} onChange={set('birthDate')} />
            <Input label="E-mail" type="email" value={form.email} onChange={set('email')} />
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
