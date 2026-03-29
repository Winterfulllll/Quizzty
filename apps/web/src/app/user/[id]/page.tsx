'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { History, Loader2, Medal, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, type PublicProfile } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

function pluralPoints(n: number) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;

  if (abs >= 11 && abs <= 19) {
    return 'баллов';
  }

  if (last === 1) {
    return 'балл';
  }

  if (last >= 2 && last <= 4) {
    return 'балла';
  }

  return 'баллов';
}

function formatDate(date: string | null) {
  if (!date) {
    return 'Дата неизвестна';
  }

  return new Date(date).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && id === currentUser.id) {
      router.replace('/profile');

      return;
    }

    let cancelled = false;

    api
      .getPublicProfile(id)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setProfile(null);
          setError(err instanceof Error ? err.message : 'Ошибка загрузки');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, currentUser, router]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-center text-muted-foreground">{error ?? 'Пользователь не найден'}</p>
      </div>
    );
  }

  const roleName = profile.role === 'ORGANIZER' ? 'Организатор' : 'Участник';

  const totalScore = profile.participatedSessions.reduce((sum, s) => sum + s.score, 0);

  const bestRank =
    profile.participatedSessions.length > 0
      ? Math.min(...profile.participatedSessions.map((s) => s.rank))
      : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex items-center gap-6">
          <Avatar size="lg" className="size-20">
            <AvatarImage src={profile.avatar ?? undefined} />

            <AvatarFallback className="text-xl">
              {profile.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col gap-1">
            <p className="text-xl font-semibold">{profile.username}</p>

            <p className="text-sm text-muted-foreground">{roleName}</p>

            {profile.status && (
              <p className="text-sm italic text-muted-foreground">{profile.status}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {profile.bio && (
        <Card className="border-border/50 shadow-sm">
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex items-center justify-around">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold">{profile.hostedSessions.length}</span>

            <span className="text-xs text-muted-foreground">
              {profile.hostedSessions.length === 1 ? 'Квиз проведён' : 'Квизов проведено'}
            </span>
          </div>

          <Separator orientation="vertical" className="h-10" />

          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold">{profile.participatedSessions.length}</span>

            <span className="text-xs text-muted-foreground">
              {profile.participatedSessions.length === 1 ? 'Участие' : 'Участий'}
            </span>
          </div>

          <Separator orientation="vertical" className="h-10" />

          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold">{totalScore}</span>

            <span className="text-xs text-muted-foreground">{pluralPoints(totalScore)}</span>
          </div>

          {bestRank !== null && (
            <>
              <Separator orientation="vertical" className="h-10" />

              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-bold">#{bestRank}</span>

                <span className="text-xs text-muted-foreground">Лучшее место</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(profile.hostedSessions.length > 0 || profile.participatedSessions.length > 0) && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="px-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <History className="size-5" />
              История
            </h2>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            {profile.hostedSessions.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Trophy className="size-4" />
                  Проведённые квизы ({profile.hostedSessions.length})
                </h3>

                <div className="flex flex-col gap-2">
                  {profile.hostedSessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{s.quiz.title}</span>

                        <span className="text-xs text-muted-foreground">
                          {formatDate(s.finishedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users className="size-3.5" />
                        {s._count.participants}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.hostedSessions.length > 0 && profile.participatedSessions.length > 0 && (
              <Separator />
            )}

            {profile.participatedSessions.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Medal className="size-4" />
                  Участие в квизах ({profile.participatedSessions.length})
                </h3>

                <div className="flex flex-col gap-2">
                  {profile.participatedSessions.map((s) => (
                    <div
                      key={s.sessionId}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{s.quiz.title}</span>

                        <span className="text-xs text-muted-foreground">
                          {formatDate(s.finishedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            s.rank === 1
                              ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
                              : s.rank === 2
                                ? 'bg-gray-300/20 text-gray-600 dark:text-gray-300'
                                : s.rank === 3
                                  ? 'bg-amber-600/15 text-amber-700 dark:text-amber-400'
                                  : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          #{s.rank}
                        </span>

                        <span className="text-sm font-medium tabular-nums">
                          {s.score} {pluralPoints(s.score)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
