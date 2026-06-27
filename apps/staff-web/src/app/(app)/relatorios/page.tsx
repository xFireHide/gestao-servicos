'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui';

interface TopService {
  label: string;
  count: number;
  revenueCents: number;
}
interface ProfessionalStat {
  professionalId: string;
  name: string;
  appointments: number;
}
interface Overview {
  revenueCents: number;
  invoicedCents: number;
  outstandingCents: number;
  paidInvoices: number;
  openInvoices: number;
  avgTicketCents: number;
  appointments: { total: number; byStatus: Record<string, number> };
  topServices: TopService[];
  byProfessional: ProfessionalStat[];
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Agendados',
  COMPLETED: 'Concluídos',
  CANCELLED: 'Cancelados',
  NO_SHOW: 'Faltas',
};

function monthRange() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    label: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const { from, to, label } = monthRange();

  const load = useCallback(() => {
    api
      .get<Overview>(`/reports/overview?from=${from}&to=${to}`)
      .then(setData)
      .catch(() => setData(null));
  }, [from, to]);

  useEffect(load, [load]);

  if (!data) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <span className="text-sm capitalize text-slate-500">{label}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Faturamento" value={brl(data.revenueCents)} tone="text-emerald-600" />
        <Metric label="Faturado" value={brl(data.invoicedCents)} tone="text-slate-800" />
        <Metric label="Em aberto" value={brl(data.outstandingCents)} tone="text-amber-600" />
        <Metric label="Ticket médio" value={brl(data.avgTicketCents)} tone="text-slate-800" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Agendamentos</h2>
          <p className="text-3xl font-semibold">{data.appointments.total}</p>
          <ul className="mt-3 space-y-1 text-sm text-slate-500">
            {Object.entries(data.appointments.byStatus).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{STATUS_LABEL[k] ?? k}</span>
                <span className="font-medium text-slate-700">{v}</span>
              </li>
            ))}
            {data.appointments.total === 0 && <li className="text-slate-400">Sem agendamentos</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Serviços mais vendidos</h2>
          <ul className="space-y-2 text-sm">
            {data.topServices.map((s) => (
              <li key={s.label} className="flex justify-between">
                <span className="text-slate-600">
                  {s.label} <span className="text-slate-400">×{s.count}</span>
                </span>
                <span className="font-medium text-slate-700">{brl(s.revenueCents)}</span>
              </li>
            ))}
            {data.topServices.length === 0 && <li className="text-slate-400">Sem dados</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Ranking de profissionais</h2>
          <ul className="space-y-2 text-sm">
            {data.byProfessional.map((p, i) => (
              <li key={p.professionalId} className="flex justify-between">
                <span className="text-slate-600">
                  {i + 1}. {p.name}
                </span>
                <span className="font-medium text-slate-700">{p.appointments}</span>
              </li>
            ))}
            {data.byProfessional.length === 0 && <li className="text-slate-400">Sem dados</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </Card>
  );
}
