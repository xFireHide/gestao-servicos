'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

type Status = 'LEAD' | 'ACTIVE' | 'INACTIVE';
type IType = 'NOTE' | 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'OTHER';

interface PatientView {
  id: string;
  name: string;
  cpf: string | null;
  phone: string;
  email: string | null;
  status: Status;
  source: string | null;
  tags: string[];
  notes: string | null;
}

interface InteractionView {
  id: string;
  type: IType;
  note: string;
  createdAt: string;
}

const STATUS_LABEL: Record<Status, string> = { LEAD: 'Lead', ACTIVE: 'Ativo', INACTIVE: 'Inativo' };
const STATUSES: Status[] = ['LEAD', 'ACTIVE', 'INACTIVE'];
const ITYPES: IType[] = ['NOTE', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'OTHER'];
const ITYPE_LABEL: Record<IType, string> = {
  NOTE: 'Nota',
  CALL: 'Ligação',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  MEETING: 'Reunião',
  OTHER: 'Outro',
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [patient, setPatient] = useState<PatientView | null>(null);
  const [timeline, setTimeline] = useState<InteractionView[]>([]);
  const [note, setNote] = useState('');
  const [type, setType] = useState<IType>('NOTE');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<PatientView>(`/patients/${id}`).then(setPatient).catch(() => setPatient(null));
    api
      .get<InteractionView[]>(`/patients/${id}/interactions`)
      .then(setTimeline)
      .catch(() => setTimeline([]));
  }, [id]);

  useEffect(load, [load]);

  async function changeStatus(status: Status) {
    await api.patch(`/patients/${id}`, { status }).catch(() => undefined);
    load();
  }

  async function addInteraction(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post(`/patients/${id}/interactions`, { type, note });
      setNote('');
      setType('NOTE');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao registrar interação');
    } finally {
      setBusy(false);
    }
  }

  if (!patient) {
    return <p className="text-slate-500">Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/pacientes" className="text-sm text-brand-700 hover:underline">
        ← Clientes
      </Link>

      <div className="grid gap-8 md:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{patient.name}</h1>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              {STATUS_LABEL[patient.status]}
            </span>
          </div>

          <Card>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Telefone</dt>
                <dd>{patient.phone}</dd>
              </div>
              <div>
                <dt className="text-slate-500">E-mail</dt>
                <dd>{patient.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">CPF</dt>
                <dd>{patient.cpf ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Origem</dt>
                <dd>{patient.source ?? '—'}</dd>
              </div>
            </dl>
            {patient.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {patient.tags.map((t) => (
                  <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s}
                  variant={s === patient.status ? 'primary' : 'ghost'}
                  onClick={() => changeStatus(s)}
                >
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Linha do tempo</h2>
            <div className="space-y-2">
              {timeline.map((i) => (
                <Card key={i.id} className="p-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{ITYPE_LABEL[i.type]}</span>
                    <span>{new Date(i.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="mt-1 text-sm">{i.note}</p>
                </Card>
              ))}
              {timeline.length === 0 && (
                <p className="text-sm text-slate-400">Nenhuma interação registrada</p>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Registrar interação</h2>
          <Card>
            <form onSubmit={addInteraction} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Tipo</span>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  value={type}
                  onChange={(e) => setType(e.target.value as IType)}
                >
                  {ITYPES.map((t) => (
                    <option key={t} value={t}>
                      {ITYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Anotação" value={note} onChange={(e) => setNote(e.target.value)} required />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Salvando…' : 'Registrar'}
              </Button>
            </form>
          </Card>
        </section>
      </div>
    </div>
  );
}
