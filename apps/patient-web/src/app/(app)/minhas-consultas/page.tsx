'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card } from '@/components/ui';

interface Appointment {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

export default function MinhasConsultasPage() {
  const [items, setItems] = useState<Appointment[]>([]);

  const load = useCallback(() => {
    api
      .get<Appointment[]>('/appointments/me')
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useEffect(load, [load]);

  async function cancel(id: string) {
    await api.del(`/appointments/${id}`);
    load();
  }

  const active = items.filter((a) => a.status !== 'CANCELLED');

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Minhas consultas</h1>
      <div className="space-y-2">
        {active.map((a) => (
          <Card key={a.id} className="flex items-center justify-between py-3">
            <span className="text-sm">
              <strong>{fmt(a.startAt)}</strong>
            </span>
            <Button variant="danger" onClick={() => cancel(a.id)}>
              Cancelar
            </Button>
          </Card>
        ))}
        {active.length === 0 && (
          <p className="text-sm text-slate-400">Você não tem consultas agendadas.</p>
        )}
      </div>
    </div>
  );
}
