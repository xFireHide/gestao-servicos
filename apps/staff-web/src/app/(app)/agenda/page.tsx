'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Slot } from '@clinica/shared';
import { api, ApiError } from '@/lib/api';
import { Button, Card } from '@/components/ui';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
}
interface PatientView {
  id: string;
  name: string;
}
interface Appointment {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  patientId: string;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

export default function AgendaPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<PatientView[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Doctor[]>('/doctors').then((d) => {
      setDoctors(d);
      if (d[0]) setDoctorId(d[0].id);
    });
    api.get<PatientView[]>('/patients').then((p) => {
      setPatients(p);
      if (p[0]) setPatientId(p[0].id);
    });
  }, []);

  const refresh = useCallback(() => {
    if (!doctorId) return;
    setError(null);
    api
      .get<Slot[]>(`/slots?doctorId=${doctorId}&date=${date}`)
      .then(setSlots)
      .catch(() => setSlots([]));
    api
      .get<Appointment[]>(`/doctors/${doctorId}/appointments?date=${date}`)
      .then(setAppointments)
      .catch(() => setAppointments([]));
  }, [doctorId, date]);

  useEffect(refresh, [refresh]);

  async function book(slot: Slot) {
    if (!patientId) {
      setError('Selecione um paciente');
      return;
    }
    try {
      await api.post('/appointments', {
        doctorId,
        patientId,
        startAt: slot.startAt,
        endAt: slot.endAt,
      });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao agendar');
    }
  }

  async function cancel(id: string) {
    await api.del(`/appointments/${id}`);
    refresh();
  }

  const patientName = (id: string) => patients.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  const activeAppointments = appointments.filter((a) => a.status !== 'CANCELLED');

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Agenda</h1>

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Médico</span>
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
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Paciente</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Horários livres</h2>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.startAt}
                onClick={() => book(s)}
                className="rounded-md border border-brand-500 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
              >
                {fmtTime(s.startAt)}
              </button>
            ))}
            {slots.length === 0 && (
              <p className="text-sm text-slate-400">Sem horários livres nesta data</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-600">Consultas do dia</h2>
          <div className="space-y-2">
            {activeAppointments.map((a) => (
              <Card key={a.id} className="flex items-center justify-between py-3">
                <span className="text-sm">
                  <strong>{fmtTime(a.startAt)}</strong> · {patientName(a.patientId)}
                </span>
                <Button variant="danger" onClick={() => cancel(a.id)}>
                  Cancelar
                </Button>
              </Card>
            ))}
            {activeAppointments.length === 0 && (
              <p className="text-sm text-slate-400">Nenhuma consulta agendada</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
