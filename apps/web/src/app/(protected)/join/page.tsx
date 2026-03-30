'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Globe, Loader2, LogIn, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api, type ActiveParticipantSession } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function JoinPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveParticipantSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    api
      .getActiveParticipantSession()
      .then((s) => setActiveSession(s))
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);

  if (user?.role === 'ORGANIZER') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-12">
        <h1 className="text-2xl font-bold">Присоединиться к квизу</h1>

        <Card className="w-full border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-muted-foreground">
              Организаторы не могут присоединяться к квизам. Смените роль на «Участник» в{' '}
              <Link href="/profile" className="font-medium text-primary hover:underline">
                личном кабинете
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function handleCodeChange(value: string) {
    setCode(
      value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6),
    );
  }

  function handleJoin() {
    if (code.length !== 6) {
      toast.error('Код должен содержать 6 символов');

      return;
    }

    setJoining(true);
    router.push(`/session/${code}`);
  }

  if (checkingSession) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeSession) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-12">
        <h1 className="text-2xl font-bold">Присоединиться к квизу</h1>

        <Card className="w-full border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-4">
            <Play className="size-10 text-primary" />

            <p className="text-center font-medium">Вы уже находитесь в комнате</p>

            <p className="text-center text-sm text-muted-foreground">
              {activeSession.quiz.title} · Комната{' '}
              <span className="font-mono font-medium tracking-wider">{activeSession.roomCode}</span>
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Чтобы присоединиться к другому квизу, сначала покиньте текущую комнату
            </p>

            <Link
              href={`/session/${activeSession.roomCode}`}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Вернуться в комнату
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Присоединиться к квизу</h1>

      <Card className="w-full border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <p className="text-sm text-muted-foreground">
            Введите код комнаты, который вам сообщил организатор
          </p>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">Код комнаты</Label>

            <Input
              id="code"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && code.length === 6) {
                  handleJoin();
                }
              }}
              placeholder="ABCDEF"
              className="text-center text-2xl font-bold tracking-[0.3em]"
              maxLength={6}
              autoFocus
            />
          </div>

          <Button
            onClick={handleJoin}
            disabled={code.length !== 6 || joining}
            className="w-full gap-2"
          >
            {joining ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Присоединиться
          </Button>
        </CardContent>
      </Card>

      <Link
        href="/rooms"
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Globe className="size-4" />
        Посмотреть публичные комнаты
      </Link>
    </div>
  );
}
