'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

type Status = 'OPEN' | 'PAID' | 'CANCELLED';

interface InvoiceView {
  id: string;
  patientId: string;
  status: Status;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
}
interface PatientOption {
  id: string;
  name: string;
}
interface Cashflow {
  inflowCents: number;
  outflowCents: number;
  balanceCents: number;
  outstandingCents: number;
}

interface ItemForm {
  description: string;
  quantity: string;
  price: string;
}

const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_LABEL: Record<Status, string> = { OPEN: 'Em aberto', PAID: 'Pago', CANCELLED: 'Cancelado' };

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { from, to };
}

export default function FinancePage() {
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [cashflow, setCashflow] = useState<Cashflow | null>(null);
  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState<ItemForm[]>([{ description: '', quantity: '1', price: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameById = (id: string) => patients.find((p) => p.id === id)?.name ?? '—';

  const load = useCallback(() => {
    const { from, to } = monthRange();
    api.get<InvoiceView[]>('/invoices').then(setInvoices).catch(() => setInvoices([]));
    api.get<PatientOption[]>('/patients').then(setPatients).catch(() => setPatients([]));
    api
      .get<Cashflow>(`/finance/cashflow?from=${from}&to=${to}`)
      .then(setCashflow)
      .catch(() => setCashflow(null));
  }, []);

  useEffect(load, [load]);

  function setItem(i: number, k: keyof ItemForm, v: string) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  }
  const addItem = () => setItems((a) => [...a, { description: '', quantity: '1', price: '' }]);
  const removeItem = (i: number) => setItems((a) => (a.length > 1 ? a.filter((_, idx) => idx !== i) : a));

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/invoices', {
        patientId,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unitPriceCents: Math.round(Number(it.price.replace(',', '.')) * 100) || 0,
        })),
      });
      setPatientId('');
      setItems([{ description: '', quantity: '1', price: '' }]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar fatura');
    } finally {
      setBusy(false);
    }
  }

  async function receive(inv: InvoiceView) {
    await api
      .post(`/invoices/${inv.id}/payments`, { amountCents: inv.balanceCents, method: 'CASH' })
      .catch(() => undefined);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Financeiro</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Summary label="Entradas (mês)" value={cashflow ? brl(cashflow.inflowCents) : '—'} tone="text-emerald-600" />
        <Summary label="Saídas (mês)" value={cashflow ? brl(cashflow.outflowCents) : '—'} tone="text-red-600" />
        <Summary label="Saldo (mês)" value={cashflow ? brl(cashflow.balanceCents) : '—'} tone="text-slate-800" />
        <Summary label="Em aberto" value={cashflow ? brl(cashflow.outstandingCents) : '—'} tone="text-amber-600" />
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-3 text-base font-semibold">Faturas</h2>
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Saldo</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">{nameById(inv.patientId)}</td>
                    <td className="px-4 py-2 text-slate-500">{brl(inv.totalCents)}</td>
                    <td className="px-4 py-2 text-slate-500">{brl(inv.balanceCents)}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {inv.status === 'OPEN' && (
                        <Button variant="ghost" onClick={() => receive(inv)}>
                          Receber
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                      Nenhuma fatura
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold">Nova fatura</h2>
          <Card>
            <form onSubmit={createInvoice} className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Cliente</span>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                >
                  <option value="">Selecione…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              {items.map((it, i) => (
                <div key={i} className="space-y-2 rounded-md border border-slate-200 p-2">
                  <Input
                    label={`Item ${i + 1}`}
                    placeholder="Descrição"
                    value={it.description}
                    onChange={(e) => setItem(i, 'description', e.target.value)}
                    required
                  />
                  <div className="flex gap-2">
                    <Input
                      label="Qtd"
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => setItem(i, 'quantity', e.target.value)}
                    />
                    <Input
                      label="Valor unit. (R$)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.price}
                      onChange={(e) => setItem(i, 'price', e.target.value)}
                      required
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover item
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItem} className="text-sm text-brand-700 hover:underline">
                + Adicionar item
              </button>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Salvando…' : 'Emitir fatura'}
              </Button>
            </form>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </Card>
  );
}
