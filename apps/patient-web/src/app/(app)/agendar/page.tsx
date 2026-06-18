'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Slot } from '@clinica/shared';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export default function AgendarPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    api.get<Doctor[]>('/doctors').then((d) => {
      setDoctors(d);
      if (d[0]) setDoctorId(d[0].id);
    });
  }, []);

  const loadSlots = useCallback(() => {
    if (!doctorId) return;
    api
      .get<Slot[]>(`/slots?doctorId=${doctorId}&date=${date}`)
      .then(setSlots)
      .catch(() => setSlots([]));
  }, [doctorId, date]);

  useEffect(loadSlots, [loadSlots]);

  async function book(slot: Slot) {
    setMessage(null);
    try {
      await api.post('/appointments/me', {
        doctorId,
        startAt: slot.startAt,
        endAt: slot.endAt,
      });
      setMessage({ kind: 'ok', text: 'Consulta agendada! Você receberá uma confirmação por e-mail.' });
      loadSlots();
    } catch (err) {
      setMessage({
        kind: 'err',
        text: err instanceof ApiError ? err.message : 'Não foi possível agendar',
      });
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Agendar consulta</h1>

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Especialista</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialty}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Data</span>
            <input
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        {message && (
          <p className={`mt-3 text-sm ${message.kind === 'ok' ? 'text-brand-700' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-slate-600">Horários disponíveis</h2>
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <button
            key={s.startAt}
            onClick={() => book(s)}
            className="rounded-md border border-brand-500 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
          >
            {fmtTime(s.startAt)}
          </button>
        ))}
        {slots.length === 0 && (
          <p className="text-sm text-slate-400">Sem horários disponíveis nesta data</p>
        )}
      </div>
    </div>
  );
}
