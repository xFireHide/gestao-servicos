'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

type StaffRole = 'RECEPTIONIST' | 'DOCTOR' | 'ADMIN';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  doctorId: string | null;
  specialty: string | null;
}
interface Availability {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

const ROLE_LABEL: Record<StaffRole, string> = {
  ADMIN: 'Admin',
  RECEPTIONIST: 'Recepção',
  DOCTOR: 'Profissional',
};
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const EMPTY = { name: '', email: '', password: '', role: 'RECEPTIONIST' as StaffRole, specialty: '', crm: '' };
const EMPTY_RULE = { weekday: '1', startTime: '09:00', endTime: '12:00', slotMinutes: '30' };

export default function TeamPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [rules, setRules] = useState<Availability[]>([]);
  const [rule, setRule] = useState(EMPTY_RULE);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const professionals = staff.filter((s) => s.doctorId);

  const load = useCallback(() => {
    api.get<StaffUser[]>('/users').then(setStaff).catch(() => setStaff([]));
  }, []);
  useEffect(load, [load]);

  const loadRules = useCallback((doctorId: string) => {
    if (!doctorId) return setRules([]);
    api.get<Availability[]>(`/doctors/${doctorId}/availability`).then(setRules).catch(() => setRules([]));
  }, []);
  useEffect(() => loadRules(selectedDoctor), [selectedDoctor, loadRules]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/users', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        specialty: form.role === 'DOCTOR' ? form.specialty : undefined,
        crm: form.role === 'DOCTOR' ? form.crm : undefined,
      });
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar membro');
    } finally {
      setBusy(false);
    }
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setRuleError(null);
    try {
      await api.post('/availability', {
        doctorId: selectedDoctor,
        weekday: Number(rule.weekday),
        startTime: rule.startTime,
        endTime: rule.endTime,
        slotMinutes: Number(rule.slotMinutes),
      });
      setRule(EMPTY_RULE);
      loadRules(selectedDoctor);
    } catch (err) {
      setRuleError(err instanceof ApiError ? err.message : 'Erro ao adicionar horário');
    }
  }

  async function removeRule(id: string) {
    await api.del(`/availability/${id}`).catch(() => undefined);
    loadRules(selectedDoctor);
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <section>
          <h1 className="mb-4 text-lg font-semibold">Equipe</h1>
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">E-mail</th>
                  <th className="px-4 py-2 font-medium">Papel</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      {u.name}
                      {u.specialty && <span className="ml-1 text-xs text-slate-400">· {u.specialty}</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      Nenhum membro
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Novo membro</h2>
          <Card>
            <form onSubmit={createUser} className="space-y-3">
              <Input label="Nome" value={form.name} onChange={set('name')} required />
              <Input label="E-mail" type="email" value={form.email} onChange={set('email')} required />
              <Input label="Senha" type="password" value={form.password} onChange={set('password')} required />
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Papel</span>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
                >
                  <option value="RECEPTIONIST">Recepção</option>
                  <option value="DOCTOR">Profissional</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              {form.role === 'DOCTOR' && (
                <>
                  <Input label="Especialidade" value={form.specialty} onChange={set('specialty')} required />
                  <Input label="Registro (CRM/etc.)" value={form.crm} onChange={set('crm')} required />
                </>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Salvando…' : 'Adicionar'}
              </Button>
            </form>
          </Card>
        </section>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Disponibilidade dos profissionais</h2>
        <Card>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Profissional</span>
            <select
              className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
            >
              <option value="">Selecione…</option>
              {professionals.map((p) => (
                <option key={p.doctorId!} value={p.doctorId!}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {selectedDoctor && (
            <div className="mt-4 grid gap-6 md:grid-cols-[1fr_320px]">
              <div>
                <ul className="space-y-1 text-sm">
                  {rules.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
                    >
                      <span>
                        {WEEKDAYS[r.weekday]} · {r.startTime}–{r.endTime} ({r.slotMinutes}min)
                      </span>
                      <button onClick={() => removeRule(r.id)} className="text-xs text-red-600 hover:underline">
                        Remover
                      </button>
                    </li>
                  ))}
                  {rules.length === 0 && <li className="text-slate-400">Nenhum horário cadastrado</li>}
                </ul>
              </div>

              <form onSubmit={addRule} className="space-y-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Dia</span>
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    value={rule.weekday}
                    onChange={(e) => setRule((r) => ({ ...r, weekday: e.target.value }))}
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <Input
                    label="Início"
                    type="time"
                    value={rule.startTime}
                    onChange={(e) => setRule((r) => ({ ...r, startTime: e.target.value }))}
                  />
                  <Input
                    label="Fim"
                    type="time"
                    value={rule.endTime}
                    onChange={(e) => setRule((r) => ({ ...r, endTime: e.target.value }))}
                  />
                </div>
                <Input
                  label="Slot (min)"
                  type="number"
                  step="5"
                  min="5"
                  value={rule.slotMinutes}
                  onChange={(e) => setRule((r) => ({ ...r, slotMinutes: e.target.value }))}
                />
                {ruleError && <p className="text-sm text-red-600">{ruleError}</p>}
                <Button type="submit" className="w-full">
                  Adicionar horário
                </Button>
              </form>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
