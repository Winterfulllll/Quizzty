'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function CreateQuizPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');

      return;
    }

    if (!authLoading && user?.role !== 'ORGANIZER') {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, user, router]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  async function handleCreate() {
    if (!title.trim()) {
      return;
    }

    setIsCreating(true);

    try {
      const quiz = await api.createQuiz({
        title: title.trim(),
        description: description.trim() || undefined,
      });

      toast.success('Квиз создан');
      router.push(`/quiz/${quiz.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Создать квиз</h1>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold">Основная информация</h2>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Название</Label>

            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              placeholder="Например: География мира"
              maxLength={200}
              aria-invalid={titleTouched && !title.trim()}
            />

            {titleTouched && !title.trim() && <FieldError message="Введите название квиза" />}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Описание (необязательно)</Label>

            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание квиза..."
              maxLength={1000}
              rows={3}
            />
          </div>

          <Button
            onClick={() => void handleCreate()}
            disabled={isCreating || !title.trim()}
            className="self-end"
          >
            {isCreating ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            Создать и добавить вопросы
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
