'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

interface PatientView {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string | null;
}

const EMPTY = { name: '', cpf: '', birthDate: '', phone: '', email: '' };

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<PatientView[]>('/patients').then(setPatients).catch(() => setPatients([]));
  }, []);

  useEffect(load, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/patients', {
        name: form.name,
        cpf: form.cpf,
        birthDate: form.birthDate,
        phone: form.phone,
        email: form.email || undefined,
      });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar paciente');
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-4 text-lg font-semibold">Pacientes</h1>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">CPF</th>
                <th className="px-4 py-2 font-medium">Telefone</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-slate-500">{p.cpf}</td>
                  <td className="px-4 py-2 text-slate-500">{p.phone}</td>
                </tr>
              ))}
              {patients.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Nenhum paciente cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Novo paciente</h2>
        <Card>
          <form onSubmit={onSubmit} className="space-y-3">
            <Input label="Nome" value={form.name} onChange={set('name')} required />
            <Input label="CPF" value={form.cpf} onChange={set('cpf')} required />
            <Input
              label="Nascimento"
              type="date"
              value={form.birthDate}
              onChange={set('birthDate')}
              required
            />
            <Input label="Telefone" value={form.phone} onChange={set('phone')} required />
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
