'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { profileSchema } from '@/lib/validations/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, refreshUser, logout } = useAuth();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    username: '',
    email: '',
    status: '',
    bio: '',
  });

  const syncForm = useCallback(() => {
    if (user) {
      setForm({
        username: user.username,
        email: user.email,
        status: user.status ?? '',
        bio: user.bio ?? '',
      });
    }
  }, [user]);

  useEffect(() => {
    syncForm();
  }, [syncForm]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !user) {
    return null;
  }

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSave() {
    const result = profileSchema.safeParse(form);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};

      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') fieldErrors[key] = issue.message;
      }

      setErrors(fieldErrors);

      return;
    }

    setIsSaving(true);

    try {
      await api.updateProfile({
        username: form.username,
        email: form.email,
        status: form.status || undefined,
        bio: form.bio || undefined,
      });

      await refreshUser();

      toast.success('Профиль обновлён');

      setErrors({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Максимальный размер файла — 2 МБ');

      return;
    }

    setIsUploading(true);

    try {
      await api.uploadAvatar(file);
      await refreshUser();

      toast.success('Аватар обновлён');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);

    try {
      await api.deleteAccount();
      await logout();
      setDeleteOpen(false);
      router.push('/');
      toast.success('Аккаунт удалён');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setIsDeleting(false);
    }
  }

  const roleName = user.role === 'ORGANIZER' ? 'Организатор' : 'Участник';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">Личный кабинет</h1>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex items-center gap-6">
          <div className="relative">
            <Avatar size="lg" className="size-20">
              <AvatarImage src={user.avatar ?? undefined} />

              <AvatarFallback className="text-xl">
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Camera className="size-3.5" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          <div>
            <p className="font-medium">{user.username}</p>

            <p className="text-sm text-muted-foreground">{roleName}</p>

            {user.status && (
              <p className="mt-1 text-sm italic text-muted-foreground">{user.status}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold">Основная информация</h2>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Имя пользователя</Label>

            <Input
              id="username"
              value={form.username}
              onChange={(e) => handleChange('username', e.target.value)}
              aria-invalid={!!errors.username}
            />

            <FieldError message={errors.username} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>

            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              aria-invalid={!!errors.email}
            />

            <FieldError message={errors.email} />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Статус</Label>

            <Input
              id="status"
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              placeholder="Например: Люблю квизы!"
              maxLength={128}
              aria-invalid={!!errors.status}
            />

            <div className="flex items-center justify-between">
              <FieldError message={errors.status} />

              <span className="ml-auto text-xs text-muted-foreground">
                {form.status.length}/128
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bio">О себе</Label>

            <Textarea
              id="bio"
              value={form.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              placeholder="Расскажите немного о себе..."
              maxLength={500}
              rows={4}
              aria-invalid={!!errors.bio}
            />

            <div className="flex items-center justify-between">
              <FieldError message={errors.bio} />

              <span className="ml-auto text-xs text-muted-foreground">{form.bio.length}/500</span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 size-4" />
              Удалить аккаунт
            </Button>

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogPopup>
          <AlertDialogTitle>Удалить аккаунт?</AlertDialogTitle>

          <AlertDialogDescription>
            Это действие необратимо. Ваш аккаунт и все связанные данные будут удалены навсегда.
          </AlertDialogDescription>

          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />} disabled={isDeleting}>
              Отмена
            </AlertDialogClose>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
