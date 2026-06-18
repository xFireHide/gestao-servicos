'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button, Card, Input } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@clinica.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ email, password });
      router.replace('/agenda');
    } catch {
      setError('Credenciais inválidas');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Portal da Equipe</h1>
        <p className="mb-6 text-sm text-slate-500">Entre para gerenciar a agenda</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
