'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Check, Clock, Crown, Globe, Loader2, LogOut, Trophy, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { useAuth } from '@/lib/auth';
import { type SessionQuestion } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Participant {
  userId: string;
  username: string;
  avatar: string | null;
  score: number;
}

type Phase = 'connecting' | 'lobby' | 'question' | 'answered' | 'results' | 'finished';

function denseRank(score: number, allScores: number[]): number {
  const unique = [...new Set(allScores)].sort((a, b) => b - a);

  return unique.indexOf(score) + 1;
}

const RANK_COLORS: Record<number, string[]> = {
  1: ['#FFD700', '#FFC107', '#FFEA00', '#FFF176'],
  2: ['#C0C0C0', '#B0BEC5', '#CFD8DC', '#90A4AE'],
  3: ['#CD7F32', '#E65100', '#FF8F00', '#D84315'],
};

function fireConfetti(rank: number) {
  const colors = RANK_COLORS[rank];

  if (!colors) {
    return;
  }

  const duration = 3000;
  const end = Date.now() + duration;

  function frame() {
    void confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
    });

    void confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }

  frame();
}

export default function SessionPage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('connecting');
  const [roomCode, setRoomCode] = useState(code.toUpperCase());
  const [sessionId, setSessionId] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [host, setHost] = useState<{ id: string; username: string; avatar: string | null } | null>(
    null,
  );
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [maxParticipants, setMaxParticipants] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [question, setQuestion] = useState<SessionQuestion | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number } | null>(
    null,
  );
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<Participant[]>([]);
  const [timer, setTimer] = useState(0);
  const [timeBonus, setTimeBonus] = useState<{ seconds: number; key: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeBonusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  const questionRef = useRef(question);
  const phaseRef = useRef(phase);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    selectedRef.current = selected;
    questionRef.current = question;
    phaseRef.current = phase;
    sessionIdRef.current = sessionId;
  });

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
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const socket = getSocket();

    socket.on(
      'join-success',
      (data: {
        session: {
          id: string;
          status: string;
          quizTitle: string;
          isPublic: boolean;
          maxParticipants: number | null;
          host: { id: string; username: string; avatar: string | null };
        };
        participants: Participant[];
      }) => {
        setSessionId(data.session.id);
        setQuizTitle(data.session.quizTitle);
        setIsPublic(data.session.isPublic);
        setMaxParticipants(data.session.maxParticipants);
        setHost(data.session.host);
        setParticipants(data.participants);
        setPhase(data.session.status === 'LOBBY' ? 'lobby' : 'question');
      },
    );

    socket.on('participant-joined', (data: { participants: Participant[] }) => {
      setParticipants(data.participants);
    });

    socket.on('room-code-changed', (data: { roomCode: string }) => {
      setRoomCode(data.roomCode);
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

    socket.on('join-error', (data: { error: string }) => {
      toast.error(data.error);
      router.push('/join');
    });

    socket.on('quiz-started', (data: { question: SessionQuestion }) => {
      setQuestion(data.question);
      setSelected(new Set());
      setAnswerResult(null);
      setCorrectOptionIds([]);
      setPhase('question');
      startTimer(data.question.timeLimitSeconds);
    });

    socket.on('new-question', (data: { question: SessionQuestion }) => {
      setQuestion(data.question);
      setSelected(new Set());
      setAnswerResult(null);
      setCorrectOptionIds([]);
      setPhase('question');
      startTimer(data.question.timeLimitSeconds);
    });

    socket.on('question-results', (data: { correctOptionIds: string[] }) => {
      if (
        phaseRef.current === 'question' &&
        selectedRef.current.size > 0 &&
        questionRef.current &&
        user
      ) {
        socket.emit('submit-answer', {
          sessionId: sessionIdRef.current,
          userId: user.id,
          questionId: questionRef.current.id,
          optionIds: Array.from(selectedRef.current),
        });
      }

      setCorrectOptionIds(data.correctOptionIds);
      setPhase('results');
      startTimer(5);
    });

    socket.on('leaderboard-update', (data: { leaderboard: Participant[] }) => {
      setLeaderboard(data.leaderboard);
    });

    socket.on('quiz-finished', (data: { leaderboard: Participant[] }) => {
      setLeaderboard(data.leaderboard);
      setPhase('finished');

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    socket.on('session-cancelled', (data: { reason: string }) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      toast.error(data.reason);
      disconnectSocket();
      router.push('/');
    });

    socket.once('kicked', (data: { reason: string }) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      toast.error(data.reason);
      disconnectSocket();
      router.push('/');
    });

    socket.on('answer-result', (data: { isCorrect: boolean; points: number; error?: string }) => {
      if (data.error) {
        toast.error(data.error);

        return;
      }

      setAnswerResult({ isCorrect: data.isCorrect, points: data.points });
      setPhase((prev) => (prev === 'results' ? prev : 'answered'));
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

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join', {
      roomCode: code.toUpperCase(),
      userId: user.id,
      username: user.username,
    });

    return () => {
      socket.off('join-success');
      socket.off('join-error');
      socket.off('participant-joined');
      socket.off('room-code-changed');
      socket.off('quiz-started');
      socket.off('new-question');
      socket.off('question-results');
      socket.off('leaderboard-update');
      socket.off('quiz-finished');
      socket.off('session-cancelled');
      socket.off('session-settings-updated');
      socket.off('kicked');
      socket.off('answer-result');
      socket.off('time-added');

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (timeBonusTimeoutRef.current) {
        clearTimeout(timeBonusTimeoutRef.current);
      }
    };
  }, [user, code, router, startTimer]);

  useEffect(() => {
    if (
      timer === 0 &&
      phaseRef.current === 'question' &&
      selectedRef.current.size > 0 &&
      questionRef.current &&
      user
    ) {
      const socket = getSocket();

      socket.emit('submit-answer', {
        sessionId,
        userId: user.id,
        questionId: questionRef.current.id,
        optionIds: Array.from(selectedRef.current),
      });
    }
  }, [timer, sessionId, user]);

  if (!user) {
    return null;
  }

  function toggleOption(optionId: string) {
    if (!question) {
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);

      if (question.type === 'SINGLE_CHOICE') {
        next.clear();
        next.add(optionId);
      } else if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }

      return next;
    });
  }

  function handleLeave() {
    disconnectSocket();
    router.push('/');
  }

  function handleSubmit() {
    if (!question || selected.size === 0) {
      return;
    }

    const socket = getSocket();

    socket.emit('submit-answer', {
      sessionId,
      userId: user!.id,
      questionId: question.id,
      optionIds: Array.from(selected),
    });
  }

  if (phase === 'connecting') {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Подключение...</p>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-12">
        <h1 className="text-2xl font-bold">{quizTitle}</h1>

        <Card className="w-full border-border/50 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4">
            <Loader2 className="size-8 animate-spin text-primary" />

            <p className="text-center text-muted-foreground">Ожидание начала квиза...</p>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Комната: <span className="font-bold">{roomCode}</span>
              </span>

              {isPublic && (
                <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <Globe className="size-3" />
                  Публичная
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {host && (
          <Card className="w-full border-border/50 shadow-sm">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="size-4 text-yellow-500" />
                <span>Организатор</span>
              </div>

              <Link
                href={`/user/${host.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <Avatar className="size-8">
                  <AvatarImage src={host.avatar ?? undefined} />

                  <AvatarFallback className="text-xs">
                    {host.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <span className="text-sm font-medium">{host.username}</span>
              </Link>
            </CardContent>
          </Card>
        )}

        <Card className="w-full border-border/50 shadow-sm">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              <span>{`Участники (${participants.length}${maxParticipants !== null ? `/${maxParticipants}` : ''})`}</span>
            </div>

            {participants.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">Пока никого нет...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <Link
                    key={p.userId}
                    href={`/user/${p.userId}`}
                    className="flex items-center gap-2 rounded-full bg-primary/10 py-1 pr-3 pl-1 text-sm font-medium transition-colors hover:bg-primary/20"
                  >
                    <Avatar className="size-6">
                      <AvatarImage src={p.avatar ?? undefined} />

                      <AvatarFallback className="text-[10px]">
                        {p.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {p.username}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button variant="ghost" className="text-muted-foreground" onClick={handleLeave}>
          <LogOut className="mr-2 size-4" />
          Выйти из комнаты
        </Button>
      </div>
    );
  }

  if (phase === 'finished') {
    const myScore = leaderboard.find((p) => p.userId === user.id)?.score ?? 0;
    const allScores = leaderboard.map((p) => p.score);
    const myRank = denseRank(myScore, allScores);
    const isTopThree = myRank >= 1 && myRank <= 3;

    if (isTopThree) {
      fireConfetti(myRank);
    }

    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-12">
        <Trophy className="size-16 text-yellow-500" />

        <h1 className="text-3xl font-bold">Квиз завершён!</h1>

        <p className="text-lg text-muted-foreground">
          Ваш результат: <span className="font-bold text-foreground">{myScore} баллов</span>
          {myRank > 0 && ` (${myRank} место)`}
        </p>

        {isTopThree && (
          <p className="text-2xl font-bold text-primary">
            {myRank === 1
              ? '🥇 Первое место!'
              : myRank === 2
                ? '🥈 Второе место!'
                : '🥉 Третье место!'}
          </p>
        )}

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
                    p.userId === user.id ? 'ring-2 ring-primary/50' : ''
                  } ${
                    rank === 1
                      ? 'bg-yellow-500/10 font-bold text-yellow-600 dark:text-yellow-300'
                      : rank === 2
                        ? 'bg-gray-300/20 font-bold text-gray-600 dark:text-gray-300'
                        : rank === 3
                          ? 'bg-orange-500/10 font-bold text-orange-600 dark:text-orange-400'
                          : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{rank}</span>

                    <Link href={`/user/${p.userId}`} className="underline-offset-2 hover:underline">
                      {p.username}
                    </Link>
                  </div>

                  <span>{p.score} баллов</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Button onClick={() => router.push('/')}>На главную</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Вопрос {(question?.index ?? 0) + 1} из {question?.total ?? 0}
        </span>

        <div className="relative flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />

          <span
            className={`text-xl font-bold tabular-nums ${timer <= 5 ? 'text-destructive' : ''}`}
          >
            {timer}с
          </span>

          {timeBonus && (
            <span
              key={timeBonus.key}
              className={`animate-float-up-fade absolute -top-1 right-0 text-sm font-bold ${
                timeBonus.seconds > 0 ? 'text-green-500' : 'text-destructive'
              }`}
            >
              {timeBonus.seconds > 0 ? '+' : ''}
              {timeBonus.seconds}с
            </span>
          )}
        </div>
      </div>

      {question && (
        <>
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
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {question.options.map((opt) => {
              const isSelected = selected.has(opt.id);
              const showCorrect = phase === 'results' && correctOptionIds.includes(opt.id);
              const showWrong =
                phase === 'results' && isSelected && !correctOptionIds.includes(opt.id);

              let className =
                'flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-4 text-sm font-medium transition-all';

              if (phase === 'answered') {
                className += ' cursor-default';

                if (isSelected) {
                  className += ' border-primary/50 bg-primary/5';
                } else {
                  className += ' border-border opacity-60';
                }
              } else if (showCorrect) {
                className += ' border-green-500 bg-green-500/10';
              } else if (showWrong) {
                className += ' border-destructive bg-destructive/10';
              } else if (isSelected) {
                className += ' border-primary bg-primary/10';
              } else {
                className += ' border-border hover:border-primary/50';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  className={className}
                  onClick={() => {
                    if (phase === 'question') {
                      toggleOption(opt.id);
                    }
                  }}
                  disabled={phase !== 'question'}
                >
                  {showCorrect && <Check className="size-5 shrink-0 text-green-500" />}

                  {showWrong && <X className="size-5 shrink-0 text-destructive" />}

                  {!showCorrect && !showWrong && (
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected ? 'border-primary bg-primary' : 'border-border'
                      }`}
                    >
                      {isSelected && <Check className="size-3 text-primary-foreground" />}
                    </div>
                  )}

                  {opt.text}
                </button>
              );
            })}
          </div>

          {phase === 'question' && (
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={selected.size === 0}
              className="w-full"
            >
              Ответить
            </Button>
          )}

          {phase === 'answered' && (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardContent className="flex items-center justify-center gap-3">
                <Check className="size-5 text-primary" />

                <span className="font-medium text-primary">
                  Ответ принят, ожидайте результатов...
                </span>
              </CardContent>
            </Card>
          )}

          {phase === 'results' && (
            <Card
              className={`border-2 ${answerResult?.isCorrect ? 'border-green-500 bg-green-500/5' : 'border-destructive bg-destructive/5'}`}
            >
              <CardContent className="flex items-center justify-center gap-3">
                {answerResult?.isCorrect ? (
                  <>
                    <Check className="size-6 text-green-500" />

                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      Верно! +{answerResult.points}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="size-6 text-destructive" />
                    <span className="text-lg font-bold text-destructive">Неверно</span>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {phase === 'results' && leaderboard.length > 0 && (
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
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                        p.userId === user.id ? 'ring-2 ring-primary/50' : ''
                      } ${
                        rank === 1
                          ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-300'
                          : rank === 2
                            ? 'bg-gray-300/20 text-gray-600 dark:text-gray-300'
                            : rank === 3
                              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                              : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-sm font-bold">{rank}</span>

                        <span className="text-sm font-medium">{p.username}</span>
                      </div>

                      <span className="text-sm font-bold">{p.score}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
