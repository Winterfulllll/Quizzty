'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  GripVertical,
  Check,
  Clock,
  Star,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api, type Quiz, type CreateQuestionData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';

interface OptionDraft {
  text: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  timeLimitSeconds: number;
  points: number;
  options: OptionDraft[];
}

const EMPTY_OPTION: OptionDraft = { text: '', isCorrect: false };

function createEmptyQuestion(): QuestionDraft {
  return {
    text: '',
    type: 'SINGLE_CHOICE',
    timeLimitSeconds: 30,
    points: 100,
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
    ],
  };
}

function QuestionEditor({
  draft,
  index,
  onChange,
  onDelete,
}: {
  draft: QuestionDraft;
  index: number;
  onChange: (draft: QuestionDraft) => void;
  onDelete: () => void;
}) {
  function setField<K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function updateOption(optIndex: number, patch: Partial<OptionDraft>) {
    const options = draft.options.map((opt, i) => {
      if (i !== optIndex) {
        if (draft.type === 'SINGLE_CHOICE' && patch.isCorrect) {
          return { ...opt, isCorrect: false };
        }

        return opt;
      }

      return { ...opt, ...patch };
    });

    onChange({ ...draft, options });
  }

  function addOption() {
    onChange({ ...draft, options: [...draft.options, { ...EMPTY_OPTION }] });
  }

  function removeOption(optIndex: number) {
    if (draft.options.length <= 2) {
      return;
    }

    onChange({ ...draft, options: draft.options.filter((_, i) => i !== optIndex) });
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <GripVertical className="size-4 text-muted-foreground" />

          <span className="text-sm font-medium text-muted-foreground">Вопрос {index + 1}</span>
        </div>

        <Button variant="ghost" size="icon-xs" onClick={onDelete}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Textarea
          value={draft.text}
          onChange={(e) => setField('text', e.target.value)}
          placeholder="Текст вопроса..."
          rows={2}
          maxLength={1000}
        />

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Settings2 className="size-3.5 text-muted-foreground" />

            <select
              value={draft.type}
              onChange={(e) =>
                setField('type', e.target.value as 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE')
              }
              className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring dark:bg-input/30"
            >
              <option value="SINGLE_CHOICE">Один ответ</option>

              <option value="MULTIPLE_CHOICE">Несколько ответов</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-muted-foreground" />

            <Input
              type="number"
              value={draft.timeLimitSeconds}
              onChange={(e) => setField('timeLimitSeconds', Math.max(5, Number(e.target.value)))}
              className="h-7 w-16 px-2 text-xs"
              min={5}
              max={300}
            />

            <span className="text-xs text-muted-foreground">сек</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Star className="size-3.5 text-muted-foreground" />

            <Input
              type="number"
              value={draft.points}
              onChange={(e) => setField('points', Math.max(1, Number(e.target.value)))}
              className="h-7 w-16 px-2 text-xs"
              min={1}
              max={10000}
            />

            <span className="text-xs text-muted-foreground">баллов</span>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Варианты ответа</Label>

          {draft.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateOption(oi, { isCorrect: !opt.isCorrect })}
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  opt.isCorrect
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-border hover:border-green-300'
                }`}
              >
                {opt.isCorrect && <Check className="size-3" />}
              </button>

              <Input
                value={opt.text}
                onChange={(e) => updateOption(oi, { text: e.target.value })}
                placeholder={`Вариант ${oi + 1}`}
                className="h-8 text-sm"
                maxLength={500}
              />

              {draft.options.length > 2 && (
                <Button variant="ghost" size="icon-xs" onClick={() => removeOption(oi)}>
                  <Trash2 className="size-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}

          {draft.options.length < 8 && (
            <Button variant="ghost" size="sm" onClick={addOption} className="self-start">
              <Plus className="mr-1 size-3" />
              Добавить вариант
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function EditQuizPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadQuiz = useCallback(async () => {
    try {
      const data = await api.getQuiz(id);

      setQuiz(data);
      setTitle(data.title);
      setDescription(data.description ?? '');
      setQuestions(
        data.questions.map((q) => ({
          text: q.text,
          type: q.type,
          timeLimitSeconds: q.timeLimitSeconds,
          points: q.points,
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');

      return;
    }

    if (!authLoading && isAuthenticated) {
      void loadQuiz();
    }
  }, [authLoading, isAuthenticated, router, loadQuiz]);

  if (authLoading || loading || !quiz) {
    return null;
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
  }

  function updateQuestion(index: number, draft: QuestionDraft) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? draft : q)));
  }

  function deleteQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): string | null {
    if (!title.trim()) {
      return 'Введите название квиза';
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      if (!q.text.trim()) {
        return `Вопрос ${i + 1}: введите текст вопроса`;
      }

      if (q.options.some((o) => !o.text.trim())) {
        return `Вопрос ${i + 1}: заполните все варианты ответа`;
      }

      if (!q.options.some((o) => o.isCorrect)) {
        return `Вопрос ${i + 1}: отметьте правильный ответ`;
      }
    }

    return null;
  }

  async function handleSave() {
    if (!quiz) {
      return;
    }

    const error = validate();

    if (error) {
      toast.error(error);

      return;
    }

    setSaving(true);

    try {
      await api.updateQuiz(id, {
        title: title.trim(),
        description: description.trim() || undefined,
      });

      const existingIds = quiz.questions.map((q) => q.id);

      for (const eid of existingIds) {
        await api.deleteQuestion(id, eid);
      }

      for (const q of questions) {
        const data: CreateQuestionData = {
          text: q.text.trim(),
          type: q.type,
          timeLimitSeconds: q.timeLimitSeconds,
          points: q.points,
          options: q.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
        };

        await api.addQuestion(id, data);
      }

      await loadQuiz();
      toast.success('Квиз сохранён');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuiz() {
    setDeleting(true);

    try {
      await api.deleteQuiz(id);
      toast.success('Квиз удалён');
      router.push('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push('/')}>
          <ArrowLeft className="size-4" />
        </Button>

        <h1 className="text-2xl font-bold">Редактирование квиза</h1>
      </div>

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
              placeholder="Название квиза"
              maxLength={200}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Описание</Label>

            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание..."
              maxLength={1000}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Вопросы{questions.length > 0 && ` (${questions.length})`}
        </h2>

        <Button variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="mr-1 size-3.5" />
          Добавить вопрос
        </Button>
      </div>

      {questions.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Пока нет вопросов</p>

            <Button variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="mr-1 size-3.5" />
              Добавить первый вопрос
            </Button>
          </CardContent>
        </Card>
      ) : (
        questions.map((q, i) => (
          <QuestionEditor
            key={i}
            draft={q}
            index={i}
            onChange={(d) => updateQuestion(i, d)}
            onDelete={() => deleteQuestion(i)}
          />
        ))
      )}

      <div className="flex items-center justify-between">
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 size-4" />
          Удалить квиз
        </Button>

        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Сохранить
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogPopup>
          <AlertDialogTitle>Удалить квиз?</AlertDialogTitle>

          <AlertDialogDescription>
            Квиз «{quiz.title}» и все его вопросы будут удалены безвозвратно.
          </AlertDialogDescription>

          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />} disabled={deleting}>
              Отмена
            </AlertDialogClose>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDeleteQuiz()}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
