'use client';

import Link from 'next/link';
import { Users, Trophy, Clock, Zap, Plus, LogIn as LogInIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const features = [
  {
    icon: Users,
    title: 'Многопользовательский',
    description: 'Участники подключаются по коду комнаты и отвечают в реальном времени',
  },
  {
    icon: Clock,
    title: 'Синхронный формат',
    description: 'Вопросы отображаются одновременно для всех — время ограничено',
  },
  {
    icon: Trophy,
    title: 'Лидерборд',
    description: 'Мгновенный подсчёт баллов и определение победителей',
  },
];

function Landing() {
  return (
    <div className="flex flex-col">
      <section className="flex flex-col items-center justify-center gap-8 px-4 py-24 text-center md:py-32">
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground">
          <Zap className="size-3.5 text-primary" />
          Квизы нового поколения
        </div>

        <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Создавайте квизы. <span className="text-primary">Играйте вместе.</span>
        </h1>

        <p className="max-w-lg text-lg text-muted-foreground">
          Интерактивная платформа для проведения квизов в реальном времени. Создайте квиз,
          поделитесь кодом комнаты и начните игру.
        </p>

        <div className="flex gap-3">
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Начать бесплатно
          </Link>

          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
          >
            Войти
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-6 px-4 pb-24 md:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-6 shadow-sm"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <feature.icon className="size-5 text-primary" />
            </div>

            <h3 className="font-semibold">{feature.title}</h3>

            <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">
          Привет, <span className="text-primary">{user?.username}</span>!
        </h1>

        <p className="mt-1 text-muted-foreground">Что будем делать сегодня?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/quiz/create"
          className="group flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
            <Plus className="size-5 text-primary" />
          </div>

          <h3 className="font-semibold">Создать квиз</h3>

          <p className="text-sm text-muted-foreground">
            Создайте новый квиз с вопросами и пригласите участников
          </p>
        </Link>

        <Link
          href="/quiz/join"
          className="group flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
            <LogInIcon className="size-5 text-primary" />
          </div>

          <h3 className="font-semibold">Присоединиться</h3>

          <p className="text-sm text-muted-foreground">
            Введите код комнаты, чтобы подключиться к квизу
          </p>
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return isAuthenticated ? <Dashboard /> : <Landing />;
}
