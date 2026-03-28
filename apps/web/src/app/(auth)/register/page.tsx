'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { registerSchema } from '@/lib/validations/auth';
import { useFormValidation } from '@/lib/hooks/use-form-validation';

export default function RegisterPage() {
  const router = useRouter();
  const { onLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { formRef, errors, isValid, onBlur, onChange, validateAll } =
    useFormValidation(registerSchema);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const data = validateAll();

    if (!data) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.register(data);

      await onLogin(res.accessToken);
      toast.success('Аккаунт создан!');
      router.push('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 pb-4">
        <h1 className="text-xl font-bold">Создать аккаунт</h1>

        <Logo className="row-span-2 h-8 self-start text-primary" />

        <p className="text-sm text-muted-foreground">Зарегистрируйтесь, чтобы начать</p>
      </CardHeader>

      <form ref={formRef} onSubmit={(e) => void onSubmit(e)} noValidate>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Имя пользователя</Label>

            <Input
              id="username"
              name="username"
              placeholder="quizmaster"
              aria-invalid={!!errors.username}
              onBlur={() => onBlur('username')}
              onChange={() => onChange('username')}
            />

            <FieldError message={errors.username} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>

            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              onBlur={() => onBlur('email')}
              onChange={() => onChange('email')}
            />

            <FieldError message={errors.email} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Пароль</Label>

            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Минимум 6 символов"
              aria-invalid={!!errors.password}
              onBlur={() => onBlur('password')}
              onChange={() => onChange('password')}
            />

            <FieldError message={errors.password} />
          </div>

          <fieldset className="flex flex-col gap-2">
            <Label>Роль</Label>

            <RadioGroup name="role" defaultValue="PARTICIPANT" className="grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5 text-sm transition-colors has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5">
                <RadioGroupItem value="PARTICIPANT" />
                Участник
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5 text-sm transition-colors has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5">
                <RadioGroupItem value="ORGANIZER" />
                Организатор
              </label>
            </RadioGroup>
          </fieldset>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={!isValid || isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Зарегистрироваться
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Войти
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
