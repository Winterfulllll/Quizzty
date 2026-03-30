'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Copy,
  Globe,
  Lock,
  Minus,
  Play,
  Plus,
  RefreshCw,
  SkipForward,
  Trash2,
  Trophy,
  UserX,
  Users,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api, type SessionInfo, type SessionQuestion } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';

interface Participant {
  userId: string;
  username: string;
  avatar: string | null;
  score: number;
}

function denseRank(score: number, allScores: number[]): number {
  const unique = [...new Set(allScores)].sort((a, b) => b - a);

  return unique.indexOf(score) + 1;
}

export default function HostPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<string>('LOBBY');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [question, setQuestion] = useState<SessionQuestion | null>(null);
  const [leaderboard, setLeaderboard] = useState<Participant[]>([]);
  const [showingResults, setShowingResults] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [addTimeAmount, setAddTimeAmount] = useState(15);
  const [timeBonus, setTimeBonus] = useState<{ seconds: number; key: number } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeBonusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setTimer(seconds);

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function init() {
      try {
        const sess = await api.createSession(id);

        if (cancelled) {
          return;
        }

        setSession(sess);
        setStatus(sess.status);
        setIsPublic(sess.isPublic ?? false);
        setMaxParticipants(sess.maxParticipants ?? null);
        setParticipants(
          sess.participants.map((p) => ({
            userId: p.user.id,
            username: p.user.username,
            avatar: p.user.avatar,
            score: p.score,
          })),
        );

        const socket = getSocket();

        socket.on(
          'host-join-success',
          (data: {
            session: {
              id: string;
              roomCode: string;
              status: string;
              currentQuestionIndex: number;
              isPublic: boolean;
              maxParticipants: number | null;
            };
            participants: Participant[];
            question: SessionQuestion | null;
            leaderboard: Participant[];
            timerPhase: 'question' | 'results' | null;
            remainingSeconds: number;
          }) => {
            setStatus(data.session.status);
            setIsPublic(data.session.isPublic);
            setMaxParticipants(data.session.maxParticipants);
            setParticipants(data.participants);

            if (data.session.status === 'IN_PROGRESS') {
              if (data.timerPhase === 'results') {
                setShowingResults(true);
                setLeaderboard(data.leaderboard);
                startTimer(data.remainingSeconds);
              } else if (data.question) {
                setQuestion(data.question);
                setShowingResults(false);
                startTimer(data.remainingSeconds);
              }
            }

            if (data.session.status === 'FINISHED') {
              setLeaderboard(data.leaderboard);
              setFinished(true);
            }
          },
        );

        socket.on('host-join-error', (data: { error: string }) => {
          toast.error(data.error);
        });

        socket.on('participant-joined', (data: { participants: Participant[] }) => {
          setParticipants(data.participants);
        });

        socket.on('answer-submitted', () => {
          /* host sees answers coming in */
        });

        socket.on('quiz-started', (data: { question: SessionQuestion }) => {
          setStatus('IN_PROGRESS');
          setQuestion(data.question);
          setShowingResults(false);
          startTimer(data.question.timeLimitSeconds);
        });

        socket.on('new-question', (data: { question: SessionQuestion }) => {
          setQuestion(data.question);
          setShowingResults(false);
          startTimer(data.question.timeLimitSeconds);
        });

        socket.on('quiz-finished', (data: { leaderboard: Participant[] }) => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          setLeaderboard(data.leaderboard);
          setFinished(true);
          setStatus('FINISHED');
        });

        socket.on('leaderboard-update', (data: { leaderboard: Participant[] }) => {
          setLeaderboard(data.leaderboard);
          setShowingResults(true);
          startTimer(5);
        });

        socket.on('time-added', (data: { seconds: number }) => {
          setTimer((prev) => {
            const newTime = Math.max(0, prev + data.seconds);

            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                setTimer((p) => {
                  if (p <= 1) {
                    if (timerRef.current) {
                      clearInterval(timerRef.current);
                      timerRef.current = null;
                    }

                    return 0;
                  }

                  return p - 1;
                });
              }, 1000);
            }

            return newTime;
          });

          setTimeBonus({ seconds: data.seconds, key: Date.now() });

          if (timeBonusTimeoutRef.current) {
            clearTimeout(timeBonusTimeoutRef.current);
          }

          timeBonusTimeoutRef.current = setTimeout(() => {
            setTimeBonus(null);
          }, 1300);
        });

        socket.on('room-code-changed', (data: { roomCode: string }) => {
          setSession((prev) => (prev ? { ...prev, roomCode: data.roomCode } : prev));
          toast.success('Код комнаты обновлён');
        });

        socket.on(
          'session-settings-updated',
          (data: { isPublic?: boolean; maxParticipants?: number | null }) => {
            if (data.isPublic !== undefined) {
              setIsPublic(data.isPublic);
            }

            if (data.maxParticipants !== undefined) {
              setMaxParticipants(data.maxParticipants);
            }
          },
        );

        socket.on('error', (data: { error: string }) => {
          toast.error(data.error);
        });

        socket.connect();

        socket.emit('host-join', { roomCode: sess.roomCode, userId: currentUser.id });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Ошибка создания сессии');
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    void init();

    return () => {
      cancelled = true;

      const socket = getSocket();

      socket.off('host-join-success');
      socket.off('host-join-error');
      socket.off('participant-joined');
      socket.off('answer-submitted');
      socket.off('quiz-started');
      socket.off('new-question');
      socket.off('quiz-finished');
      socket.off('leaderboard-update');
      socket.off('time-added');
      socket.off('room-code-changed');
      socket.off('session-settings-updated');
      socket.off('error');

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (timeBonusTimeoutRef.current) {
        clearTimeout(timeBonusTimeoutRef.current);
      }
    };
  }, [authLoading, isAuthenticated, user, id, router, startTimer]);

  if (authLoading || loading || !session || !user) {
    return null;
  }

  function handleCopyCode() {
    void navigator.clipboard.writeText(session!.roomCode);
    toast.success('Код скопирован');
  }

  function handleRegenerateCode() {
    const socket = getSocket();

    socket.emit('regenerate-code', { sessionId: session!.id, userId: user!.id });
  }

  function handleTogglePublic() {
    const socket = getSocket();
    const newValue = !isPublic;

    socket.emit('update-session-settings', {
      sessionId: session!.id,
      userId: user!.id,
      isPublic: newValue,
    });
  }

  function handleMaxParticipantsChange(value: number | null) {
    const socket = getSocket();

    socket.emit('update-session-settings', {
      sessionId: session!.id,
      userId: user!.id,
      maxParticipants: value,
    });
  }

  function handleStart() {
    const socket = getSocket();

    socket.emit('start-quiz', { sessionId: session!.id, userId: user!.id });
  }

  function handleShowResults() {
    const socket = getSocket();

    socket.emit('show-results', { sessionId: session!.id, userId: user!.id });
  }

  function handleModifyTime(seconds: number) {
    const socket = getSocket();

    socket.emit('add-time', { sessionId: session!.id, userId: user!.id, seconds });
  }

  function handleKick(targetUserId: string) {
    const socket = getSocket();

    socket.emit('kick-participant', {
      sessionId: session!.id,
      userId: user!.id,
      targetUserId,
    });
  }

  function handleCancelSession() {
    const socket = getSocket();

    socket.emit('cancel-session', { sessionId: session!.id, userId: user!.id });
    disconnectSocket();
    router.push('/');
    toast.success('Сессия удалена');
  }

  function handleNext() {
    const socket = getSocket();

    socket.emit('next-question', { sessionId: session!.id, userId: user!.id });
  }

  const cancelDialog = (
    <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
      <AlertDialogPopup>
        <AlertDialogTitle>Завершить сессию?</AlertDialogTitle>

        <AlertDialogDescription>
          Сессия будет удалена, а все участники отключены. Это действие необратимо.
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" size="sm" />}>
            Отмена
          </AlertDialogClose>

          <Button variant="destructive" size="sm" onClick={handleCancelSession}>
            Завершить
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );

  if (finished || status === 'FINISHED') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-12">
        <Trophy className="size-16 text-yellow-500" />

        <h1 className="text-3xl font-bold">Квиз завершён!</h1>

        <Card className="w-full border-border/50 shadow-sm">
          <CardContent className="flex flex-col gap-3">
            {leaderboard.map((p) => {
              const rank = denseRank(
                p.score,
                leaderboard.map((o) => o.score),
              );

              return (
                <div
                  key={p.userId}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    rank === 1
                      ? 'bg-yellow-500/10 text-yellow-500 dark:text-yellow-300'
                      : rank === 2
                        ? 'bg-gray-300/20 text-gray-500 dark:text-gray-300'
                        : rank === 3
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                          : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{rank}</span>

                    <Link
                      href={`/user/${p.userId}`}
                      className="font-medium underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.username}
                    </Link>
                  </div>

                  <span className="font-bold">{p.score} баллов</span>
                </div>
              );
            })}

            {leaderboard.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">Никто не участвовал</p>
            )}
          </CardContent>
        </Card>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
          <Button
            variant="destructive"
            className="h-9 gap-2 text-sm sm:h-10 sm:px-6 sm:text-base"
            onClick={() => setCancelOpen(true)}
          >
            <Trash2 className="size-3.5 sm:size-4" />
            Удалить сессию
          </Button>

          <Button
            className="h-9 text-sm sm:h-10 sm:px-6 sm:text-base"
            onClick={() => router.push('/')}
          >
            На главную
          </Button>
        </div>

        {cancelDialog}
      </div>
    );
  }

  if (status === 'LOBBY') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-8 sm:gap-8 sm:py-12">
        <h1 className="text-xl font-bold sm:text-2xl">Лобби</h1>

        <Card className="w-full border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 sm:gap-4">
            <p className="text-xs text-muted-foreground sm:text-sm">Код комнаты</p>

            <span className="text-3xl font-bold tracking-[0.3em] sm:text-5xl">
              {session.roomCode}
            </span>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleCopyCode}
              >
                <Copy className="size-3.5" />
                Скопировать
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleRegenerateCode}
              >
                <RefreshCw className="size-3.5" />
                Сменить
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground sm:text-sm">
              Участники могут подключиться на странице «Присоединиться»
            </p>
          </CardContent>
        </Card>

        <Card className="w-full border-border/50 shadow-sm">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              <span>{`Участники (${participants.length}${maxParticipants !== null ? `/${maxParticipants}` : ''})`}</span>
            </div>

            {participants.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Ожидание участников...
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center gap-2 rounded-full bg-primary/10 py-1 pr-1.5 pl-1 text-sm font-medium transition-colors hover:bg-primary/20"
                  >
                    <Link
                      href={`/user/${p.userId}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Avatar className="size-6">
                        <AvatarImage src={p.avatar ?? undefined} />

                        <AvatarFallback className="text-[10px]">
                          {p.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      {p.username}
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleKick(p.userId)}
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Исключить"
                    >
                      <UserX className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="w-full border-border/50 shadow-sm">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                {isPublic ? (
                  <Globe className="size-4 text-green-500" />
                ) : (
                  <Lock className="size-4 text-muted-foreground" />
                )}

                <span>{isPublic ? 'Публичная комната' : 'Приватная комната'}</span>
              </div>

              <Button
                variant={isPublic ? 'outline' : 'default'}
                size="sm"
                className="w-full text-xs sm:w-auto sm:text-sm"
                onClick={handleTogglePublic}
              >
                {isPublic ? 'Сделать приватной' : 'Сделать публичной'}
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">Макс. участников</span>

              <div className="flex items-center gap-2">
                {maxParticipants !== null ? (
                  <>
                    <div className="flex items-center gap-0.5 rounded-md border border-border">
                      <button
                        type="button"
                        className="rounded-l-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted"
                        onClick={() => {
                          const v = maxParticipants ?? 5;
                          const step = v <= 5 ? 1 : 5;

                          handleMaxParticipantsChange(Math.max(2, v - step));
                        }}
                      >
                        <Minus className="size-3" />
                      </button>

                      <span className="min-w-[2.5rem] text-center text-sm font-medium tabular-nums">
                        {maxParticipants}
                      </span>

                      <button
                        type="button"
                        className="rounded-r-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted"
                        onClick={() => {
                          const v = maxParticipants ?? 5;
                          const step = v < 5 ? 1 : 5;

                          handleMaxParticipantsChange(Math.min(100, v + step));
                        }}
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => handleMaxParticipantsChange(null)}
                    >
                      Убрать лимит
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm"
                    onClick={() => handleMaxParticipantsChange(20)}
                  >
                    Установить лимит
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
          <Button
            variant="destructive"
            className="h-9 gap-2 text-sm sm:h-10 sm:px-6 sm:text-base"
            onClick={() => setCancelOpen(true)}
          >
            <Trash2 className="size-3.5 sm:size-4" />
            Удалить сессию
          </Button>

          <Button
            onClick={handleStart}
            disabled={participants.length === 0}
            className="h-9 gap-2 text-sm sm:h-10 sm:px-6 sm:text-base"
          >
            <Play className="size-3.5 sm:size-4" />
            Начать квиз
          </Button>
        </div>

        {cancelDialog}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            Вопрос {(question?.index ?? 0) + 1} из {question?.total ?? 0}
          </h1>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setCancelOpen(true)}
            >
              <Trash2 className="mr-1 size-3.5" />
              Завершить
            </Button>

            {!showingResults ? (
              <Button variant="outline" size="sm" onClick={handleShowResults}>
                <BarChart3 className="mr-1 size-3.5" />
                Показать ответы
              </Button>
            ) : (
              <Button size="sm" onClick={handleNext}>
                <SkipForward className="mr-1 size-3.5" />
                Далее
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          {!showingResults && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2.5 py-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleModifyTime(-addTimeAmount)}
            >
              -{addTimeAmount}с
            </Button>
          )}

          <div className="relative">
            <span
              className={`text-3xl font-bold tabular-nums ${timer <= 5 ? 'text-destructive' : ''}`}
            >
              {timer}с
            </span>

            {timeBonus && (
              <span
                key={timeBonus.key}
                className={`animate-float-up-fade absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-bold ${
                  timeBonus.seconds > 0 ? 'text-green-500' : 'text-destructive'
                }`}
              >
                {timeBonus.seconds > 0 ? '+' : ''}
                {timeBonus.seconds}с
              </span>
            )}
          </div>

          {!showingResults && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2.5 py-1.5 text-green-600 hover:bg-green-500/10 hover:text-green-600"
              onClick={() => handleModifyTime(addTimeAmount)}
            >
              +{addTimeAmount}с
            </Button>
          )}
        </div>

        {!showingResults && (
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-0.5 rounded-md border border-border">
              <button
                type="button"
                className="rounded-l-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted"
                onClick={() => setAddTimeAmount((v) => Math.max(5, v - 5))}
              >
                <Minus className="size-3" />
              </button>

              <span className="min-w-[2.5rem] text-center text-xs font-medium tabular-nums text-muted-foreground">
                {addTimeAmount}с
              </span>

              <button
                type="button"
                className="rounded-r-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted"
                onClick={() => setAddTimeAmount((v) => Math.min(60, v + 5))}
              >
                <Plus className="size-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {question && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-col gap-4">
            <p className="text-xl font-medium">{question.text}</p>

            {question.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={question.imageUrl}
                alt="Вопрос"
                className="max-h-64 rounded-lg object-contain"
              />
            )}

            <div className="flex flex-col gap-2">
              {question.options.map((opt) => (
                <div
                  key={opt.id}
                  className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium"
                >
                  {opt.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {leaderboard.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="flex flex-col gap-2">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Trophy className="size-4" />
              Таблица лидеров
            </h2>

            {leaderboard.slice(0, 5).map((p) => {
              const rank = denseRank(
                p.score,
                leaderboard.map((o) => o.score),
              );

              return (
                <div
                  key={p.userId}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-sm font-bold text-muted-foreground">{rank}</span>

                    <Link
                      href={`/user/${p.userId}`}
                      className="text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {p.username}
                    </Link>
                  </div>

                  <span className="text-sm font-bold">{p.score}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {cancelDialog}
    </div>
  );
}
