'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Globe, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { type PublicRoom } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function RoomsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const isParticipant = user?.role === 'PARTICIPANT';
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const socket = getSocket();

    socket.on('public-rooms-updated', (data: { rooms: PublicRoom[] }) => {
      setRooms(data.rooms);
      setLoading(false);
    });

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('watch-public-rooms');

    return () => {
      socket.emit('unwatch-public-rooms');
      socket.off('public-rooms-updated');
    };
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Globe className="size-6 text-primary" />
        <h1 className="text-2xl font-bold">Публичные комнаты</h1>
      </div>

      {rooms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Globe className="size-10 text-muted-foreground/50" />

            <p className="text-center text-muted-foreground">
              Сейчас нет публичных комнат. Создайте свой квиз и сделайте комнату публичной!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map((room) => {
            const isFull =
              room.maxParticipants !== null && room._count.participants >= room.maxParticipants;

            return (
              <Card
                key={room.id}
                className="border-border/50 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-semibold">{room.quiz.title}</h2>

                      <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium tracking-wider text-primary">
                        {room.roomCode}
                      </span>
                    </div>

                    {room.quiz.description && (
                      <p className="truncate text-sm text-muted-foreground">
                        {room.quiz.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <Link
                        href={`/user/${room.quiz.createdBy.id}`}
                        className="flex items-center gap-1.5 hover:underline"
                      >
                        <Avatar className="size-4">
                          <AvatarImage src={room.quiz.createdBy.avatar ?? undefined} />

                          <AvatarFallback className="text-[8px]">
                            {room.quiz.createdBy.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {room.quiz.createdBy.username}
                      </Link>

                      <span>{room.quiz._count.questions} вопросов</span>

                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {room._count.participants}
                        {room.maxParticipants !== null && ` / ${room.maxParticipants}`}
                      </span>
                    </div>
                  </div>

                  {isAuthenticated && isParticipant ? (
                    <Link href={`/session/${room.roomCode}`}>
                      <Button size="sm" disabled={isFull}>
                        {isFull ? 'Заполнена' : 'Войти'}
                      </Button>
                    </Link>
                  ) : isAuthenticated ? (
                    <Button size="sm" variant="outline" disabled title="Смените роль на «Участник»">
                      Только для участников
                    </Button>
                  ) : (
                    <Link href="/login">
                      <Button variant="outline" size="sm">
                        Войти
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
