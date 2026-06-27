'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card } from '@/components/ui';

type Plan = 'FREE' | 'PRO' | 'BUSINESS';

interface Subscription {
  name: string;
  slug: string;
  plan: Plan;
  status: string;
  trialEndsAt: string | null;
}

const PLANS: { value: Plan; label: string; price: string; features: string[] }[] = [
  { value: 'FREE', label: 'Free', price: 'R$ 0', features: ['1 profissional', 'Agenda + clientes'] },
  { value: 'PRO', label: 'Pro', price: 'R$ 99/mês', features: ['Profissionais ilimitados', 'Financeiro', 'Relatórios'] },
  { value: 'BUSINESS', label: 'Business', price: 'R$ 249/mês', features: ['Tudo do Pro', 'Multi-unidade', 'Suporte prioritário'] },
];

const STATUS_LABEL: Record<string, string> = {
  TRIALING: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  CANCELLED: 'Cancelada',
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<Subscription>('/subscription').then(setSub).catch(() => setSub(null));
  }, []);

  useEffect(load, [load]);

  async function choose(plan: Plan) {
    if (!isAdmin) return;
    setBusy(true);
    try {
      await api.patch('/subscription', { plan });
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!sub) return <p className="text-slate-500">Carregando…</p>;

  const trialInfo =
    sub.status === 'TRIALING' && sub.trialEndsAt
      ? `Teste até ${new Date(sub.trialEndsAt).toLocaleDateString('pt-BR')}`
      : null;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Assinatura</h1>

      <Card>
        <p className="text-sm text-slate-500">Empresa</p>
        <p className="text-lg font-semibold">{sub.name}</p>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700">
            Plano {sub.plan}
          </span>
          <span className="text-slate-500">{STATUS_LABEL[sub.status] ?? sub.status}</span>
          {trialInfo && <span className="text-amber-600">· {trialInfo}</span>}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const current = p.value === sub.plan;
          return (
            <Card key={p.value} className={current ? 'border-brand-500 ring-1 ring-brand-500' : ''}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">{p.label}</h2>
                <span className="text-sm text-slate-500">{p.price}</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {p.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <div className="mt-4">
                {current ? (
                  <Button variant="ghost" disabled className="w-full">
                    Plano atual
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={!isAdmin || busy}
                    onClick={() => choose(p.value)}
                  >
                    {isAdmin ? 'Escolher' : 'Somente admin'}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        A cobrança automática (cartão/PIX) será integrada em breve. Por ora, a troca de plano é manual.
      </p>
    </div>
  );
}
