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
  ImagePlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/lib/auth';
import { api, type Quiz, type CreateQuestionData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
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
  key: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  timeLimitSeconds: number;
  points: number;
  options: OptionDraft[];
  imageUrl: string | null;
  imageFile: File | null;
}

const EMPTY_OPTION: OptionDraft = { text: '', isCorrect: false };

let nextKey = 0;

function generateKey(): string {
  return `q-${++nextKey}`;
}

function createEmptyQuestion(): QuestionDraft {
  return {
    key: generateKey(),
    text: '',
    type: 'SINGLE_CHOICE',
    timeLimitSeconds: 30,
    points: 100,
    options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
    ],
    imageUrl: null,
    imageFile: null,
  };
}

function validateQuestion(q: QuestionDraft): string | null {
  if (!q.text.trim()) {
    return 'Введите текст вопроса';
  }

  if (q.options.some((o) => !o.text.trim())) {
    return 'Заполните все варианты ответа';
  }

  if (!q.options.some((o) => o.isCorrect)) {
    return 'Отметьте правильный ответ';
  }

  const texts = q.options.map((o) => o.text.trim().toLowerCase());
  const unique = new Set(texts);

  if (unique.size !== texts.length) {
    return 'Варианты ответа не должны повторяться';
  }

  return null;
}

function SortableQuestion({
  draft,
  index,
  error,
  onChange,
  onDelete,
}: {
  draft: QuestionDraft;
  index: number;
  error: string | null;
  onChange: (draft: QuestionDraft) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: draft.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

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
    <div ref={setNodeRef} style={style}>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>

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

          {draft.imageUrl || draft.imageFile ? (
            <div className="relative inline-block self-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  draft.imageFile ? URL.createObjectURL(draft.imageFile) : (draft.imageUrl ?? '')
                }
                alt="Вложение"
                className="max-h-48 rounded-lg border border-border object-contain"
              />

              <button
                type="button"
                onClick={() => onChange({ ...draft, imageUrl: null, imageFile: null })}
                className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 self-start rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <ImagePlus className="size-4" />
              Добавить изображение
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                      toast.error('Максимальный размер файла — 2 МБ');

                      return;
                    }

                    onChange({ ...draft, imageFile: file, imageUrl: null });
                  }

                  e.target.value = '';
                }}
              />
            </label>
          )}

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

          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
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
  const [titleTouched, setTitleTouched] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadQuiz = useCallback(async () => {
    try {
      const data = await api.getQuiz(id);

      setQuiz(data);
      setTitle(data.title);
      setDescription(data.description ?? '');
      setQuestions(
        data.questions.map((q) => ({
          key: generateKey(),
          text: q.text,
          type: q.type,
          timeLimitSeconds: q.timeLimitSeconds,
          points: q.points,
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          imageUrl: q.imageUrl,
          imageFile: null,
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setQuestions((prev) => {
      const oldIndex = prev.findIndex((q) => q.key === active.id);
      const newIndex = prev.findIndex((q) => q.key === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);

      next.splice(newIndex, 0, moved);

      return next;
    });
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
  }

  function updateQuestion(key: string, draft: QuestionDraft) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? draft : q)));
  }

  function deleteQuestion(key: string) {
    setQuestions((prev) => prev.filter((q) => q.key !== key));
  }

  const questionErrors = new Map<string, string>();

  for (const q of questions) {
    const err = validateQuestion(q);

    if (err) {
      questionErrors.set(q.key, err);
    }
  }

  const titleMissing = !title.trim();
  const hasErrors = titleMissing || questionErrors.size > 0;

  async function handleSave() {
    if (!quiz) {
      return;
    }

    if (hasErrors) {
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
          imageUrl: q.imageUrl ?? undefined,
        };

        const created = await api.addQuestion(id, data);

        if (q.imageFile) {
          await api.uploadQuestionImage(id, created.id, q.imageFile);
        }
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

  const questionKeys = questions.map((q) => q.key);

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
              onBlur={() => setTitleTouched(true)}
              placeholder="Название квиза"
              maxLength={200}
              aria-invalid={titleTouched && titleMissing}
            />

            {titleTouched && titleMissing && <FieldError message="Введите название квиза" />}
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questionKeys} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-6">
              {questions.map((q, i) => (
                <SortableQuestion
                  key={q.key}
                  draft={q}
                  index={i}
                  error={questionErrors.get(q.key) ?? null}
                  onChange={(d) => updateQuestion(q.key, d)}
                  onDelete={() => deleteQuestion(q.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center justify-between">
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 size-4" />
          Удалить квиз
        </Button>

        <Button onClick={() => void handleSave()} disabled={saving || hasErrors}>
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
