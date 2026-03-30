'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  Medal,
  RefreshCw,
  Save,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api, type HostedSessionHistory, type ParticipatedSessionHistory } from '@/lib/api';
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

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const [hostedHistory, setHostedHistory] = useState<HostedSessionHistory[]>([]);
  const [participatedHistory, setParticipatedHistory] = useState<ParticipatedSessionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [clearingHosted, setClearingHosted] = useState(false);
  const [clearingParticipated, setClearingParticipated] = useState(false);
  const [clearHostedOpen, setClearHostedOpen] = useState(false);
  const [clearParticipatedOpen, setClearParticipatedOpen] = useState(false);

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordTouched, setPasswordTouched] = useState<Set<string>>(new Set());
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [form, setForm] = useState({
    username: '',
    email: '',
    status: '',
    bio: '',
  });

  const original = useMemo(
    () => ({
      username: user?.username ?? '',
      email: user?.email ?? '',
      status: user?.status ?? '',
      bio: user?.bio ?? '',
    }),
    [user],
  );

  const hasChanges = useMemo(
    () =>
      form.username !== original.username ||
      form.email !== original.email ||
      form.status !== original.status ||
      form.bio !== original.bio,
    [form, original],
  );

  const isValid = useMemo(() => profileSchema.safeParse(form).success, [form]);

  const syncForm = useCallback(() => {
    if (user) {
      setForm({
        username: user.username,
        email: user.email,
        status: user.status ?? '',
        bio: user.bio ?? '',
      });

      setErrors({});
      setTouched(new Set());
    }
  }, [user]);

  useEffect(() => {
    syncForm();
  }, [syncForm]);

  useEffect(() => {
    setHistoryLoading(true);

    Promise.all([api.getHostedHistory(), api.getParticipatedHistory()])
      .then(([hosted, participated]) => {
        setHostedHistory(hosted);
        setParticipatedHistory(participated);
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  if (!user) {
    return null;
  }

  function validateField(field: string) {
    const result = profileSchema.safeParse(form);

    if (result.success) {
      setErrors((prev) => {
        if (!prev[field]) {
          return prev;
        }

        const next = { ...prev };

        delete next[field];

        return next;
      });

      return;
    }

    const issue = result.error.issues.find((i) => i.path[0] === field);

    if (issue) {
      setErrors((prev) => ({ ...prev, [field]: issue.message }));
    } else {
      setErrors((prev) => {
        if (!prev[field]) {
          return prev;
        }

        const next = { ...prev };

        delete next[field];

        return next;
      });
    }
  }

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (touched.has(field)) {
      setTimeout(() => {
        validateField(field);
      }, 0);
    }
  }

  function handleBlur(field: string) {
    setTouched((prev) => new Set(prev).add(field));
    validateField(field);
  }

  async function handleSave() {
    const result = profileSchema.safeParse(form);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};

      for (const issue of result.error.issues) {
        const key = issue.path[0];

        if (typeof key === 'string') {
          fieldErrors[key] = issue.message;
        }
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
      setTouched(new Set());
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

  function validatePasswordField(field: string, values = passwords) {
    const errs: Record<string, string> = {};

    if (field === 'currentPassword' && !values.currentPassword) {
      errs.currentPassword = 'Введите текущий пароль';
    }

    if (field === 'newPassword') {
      if (!values.newPassword) {
        errs.newPassword = 'Введите новый пароль';
      } else if (values.newPassword.length < 6) {
        errs.newPassword = 'Минимум 6 символов';
      } else if (values.newPassword.length > 128) {
        errs.newPassword = 'Максимум 128 символов';
      }
    }

    if (field === 'confirmPassword') {
      if (values.newPassword && !values.confirmPassword) {
        errs.confirmPassword = 'Повторите новый пароль';
      } else if (values.confirmPassword && values.confirmPassword !== values.newPassword) {
        errs.confirmPassword = 'Пароли не совпадают';
      }
    }

    setPasswordErrors((prev) => {
      const next = { ...prev };

      if (errs[field]) {
        next[field] = errs[field];
      } else {
        delete next[field];
      }

      return next;
    });
  }

  function handlePasswordChange(field: string, value: string) {
    const updated = { ...passwords, [field]: value };

    setPasswords(updated);

    if (passwordTouched.has(field)) {
      setTimeout(() => {
        validatePasswordField(field, updated);
      }, 0);
    }

    if (
      field === 'newPassword' &&
      passwordTouched.has('confirmPassword') &&
      updated.confirmPassword
    ) {
      setTimeout(() => {
        validatePasswordField('confirmPassword', updated);
      }, 0);
    }
  }

  function handlePasswordBlur(field: string) {
    setPasswordTouched((prev) => new Set(prev).add(field));
    validatePasswordField(field);
  }

  const showConfirmField = passwords.newPassword.length >= 6;

  const isPasswordFormValid =
    passwords.currentPassword.length > 0 &&
    passwords.newPassword.length >= 6 &&
    passwords.newPassword.length <= 128 &&
    passwords.confirmPassword === passwords.newPassword &&
    passwords.confirmPassword.length > 0;

  const hasPasswordInput =
    passwords.currentPassword.length > 0 ||
    passwords.newPassword.length > 0 ||
    passwords.confirmPassword.length > 0;

  async function handleChangePassword() {
    if (!isPasswordFormValid) {
      return;
    }

    setIsChangingPassword(true);

    try {
      await api.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });

      toast.success('Пароль успешно изменён');

      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
      setPasswordTouched(new Set());
      setShowPasswords({ current: false, new: false, confirm: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка смены пароля');
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleClearHostedHistory() {
    setClearingHosted(true);

    try {
      await api.clearHostedHistory();
      setHostedHistory([]);
      setClearHostedOpen(false);
      toast.success('История проведённых квизов очищена');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка очистки');
    } finally {
      setClearingHosted(false);
    }
  }

  async function handleClearParticipatedHistory() {
    setClearingParticipated(true);

    try {
      await api.clearParticipatedHistory();
      setParticipatedHistory([]);
      setClearParticipatedOpen(false);
      toast.success('История участия очищена');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка очистки');
    } finally {
      setClearingParticipated(false);
    }
  }

  async function handleSwitchRole() {
    if (!user) {
      return;
    }

    const newRole = user.role === 'ORGANIZER' ? 'PARTICIPANT' : 'ORGANIZER';

    setSwitchingRole(true);

    try {
      await api.changeRole(newRole);
      await refreshUser();
      toast.success(`Роль изменена на «${newRole === 'ORGANIZER' ? 'Организатор' : 'Участник'}»`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка смены роли');
    } finally {
      setSwitchingRole(false);
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
              onChange={(e) => void handleAvatarUpload(e)}
            />
          </div>

          <div>
            <p className="font-medium">{user.username}</p>

            <button
              type="button"
              onClick={() => void handleSwitchRole()}
              disabled={switchingRole}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {roleName}

              {switchingRole ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
            </button>

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
              onBlur={() => handleBlur('username')}
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
              onBlur={() => handleBlur('email')}
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
              onBlur={() => handleBlur('status')}
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
              onBlur={() => handleBlur('bio')}
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

            <Button
              onClick={() => void handleSave()}
              disabled={isSaving || !hasChanges || !isValid}
            >
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

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold">Смена пароля</h2>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="currentPassword">Текущий пароль</Label>

            <div className="relative">
              <Input
                id="currentPassword"
                type={showPasswords.current ? 'text' : 'password'}
                value={passwords.currentPassword}
                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                onBlur={() => handlePasswordBlur('currentPassword')}
                aria-invalid={!!passwordErrors.currentPassword}
                className="pr-10"
              />

              <button
                type="button"
                onClick={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPasswords.current ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            <FieldError message={passwordErrors.currentPassword} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="newPassword">Новый пароль</Label>

            <div className="relative">
              <Input
                id="newPassword"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwords.newPassword}
                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                onBlur={() => handlePasswordBlur('newPassword')}
                aria-invalid={!!passwordErrors.newPassword}
                className="pr-10"
              />

              <button
                type="button"
                onClick={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPasswords.new ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            <FieldError message={passwordErrors.newPassword} />
          </div>

          {showConfirmField && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">Повторите новый пароль</Label>

              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwords.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  onBlur={() => handlePasswordBlur('confirmPassword')}
                  aria-invalid={!!passwordErrors.confirmPassword}
                  className="pr-10"
                />

                <button
                  type="button"
                  onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>

              <FieldError message={passwordErrors.confirmPassword} />
            </div>
          )}

          <div className="mt-2 flex justify-end">
            <Button
              onClick={() => void handleChangePassword()}
              disabled={isChangingPassword || !hasPasswordInput || !isPasswordFormValid}
            >
              {isChangingPassword ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 size-4" />
              )}
              Сменить пароль
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="px-4 pb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-5" />
            История
          </h2>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {user.role === 'ORGANIZER' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Trophy className="size-4" />
                      Проведённые квизы ({hostedHistory.length})
                    </h3>

                    {hostedHistory.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setClearHostedOpen(true)}
                      >
                        <Trash2 className="mr-1 size-3" />
                        Очистить
                      </Button>
                    )}
                  </div>

                  {hostedHistory.length === 0 ? (
                    <p className="py-3 text-center text-sm text-muted-foreground">
                      Вы ещё не проводили квизы
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {hostedHistory.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{s.quiz.title}</span>

                            <span className="text-xs text-muted-foreground">
                              {s.finishedAt
                                ? new Date(s.finishedAt).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Дата неизвестна'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="size-3.5" />
                            {s._count.participants}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {user.role === 'PARTICIPANT' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Medal className="size-4" />
                      Участие в квизах ({participatedHistory.length})
                    </h3>

                    {participatedHistory.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setClearParticipatedOpen(true)}
                      >
                        <Trash2 className="mr-1 size-3" />
                        Очистить
                      </Button>
                    )}
                  </div>

                  {participatedHistory.length === 0 ? (
                    <p className="py-3 text-center text-sm text-muted-foreground">
                      Вы ещё не участвовали в квизах
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {participatedHistory.map((s) => (
                        <div
                          key={s.sessionId}
                          className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-4 py-3"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{s.quiz.title}</span>

                            <span className="text-xs text-muted-foreground">
                              {s.finishedAt
                                ? new Date(s.finishedAt).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Дата неизвестна'}
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
                  )}
                </div>
              )}
            </>
          )}
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
              onClick={() => void handleDeleteAccount()}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      <AlertDialog open={clearHostedOpen} onOpenChange={setClearHostedOpen}>
        <AlertDialogPopup>
          <AlertDialogTitle>Очистить историю проведённых квизов?</AlertDialogTitle>

          <AlertDialogDescription>
            Все записи о проведённых сессиях будут удалены. Это действие необратимо.
          </AlertDialogDescription>

          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline" size="sm" />}
              disabled={clearingHosted}
            >
              Отмена
            </AlertDialogClose>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleClearHostedHistory()}
              disabled={clearingHosted}
            >
              {clearingHosted && <Loader2 className="mr-2 size-4 animate-spin" />}
              Очистить
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      <AlertDialog open={clearParticipatedOpen} onOpenChange={setClearParticipatedOpen}>
        <AlertDialogPopup>
          <AlertDialogTitle>Очистить историю участия?</AlertDialogTitle>

          <AlertDialogDescription>
            Все записи о вашем участии в квизах будут удалены. Это действие необратимо.
          </AlertDialogDescription>

          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline" size="sm" />}
              disabled={clearingParticipated}
            >
              Отмена
            </AlertDialogClose>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleClearParticipatedHistory()}
              disabled={clearingParticipated}
            >
              {clearingParticipated && <Loader2 className="mr-2 size-4 animate-spin" />}
              Очистить
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
