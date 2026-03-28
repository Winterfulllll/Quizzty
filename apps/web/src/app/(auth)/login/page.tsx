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
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { loginSchema } from '@/lib/validations/auth';
import { useFormValidation } from '@/lib/hooks/use-form-validation';

export default function LoginPage() {
  const router = useRouter();
  const { onLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const { formRef, errors, isValid, onBlur, onChange, validateAll } =
    useFormValidation(loginSchema);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const data = validateAll();

    if (!data) {
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.login(data);

      await onLogin(res.accessToken);
      toast.success('Добро пожаловать!');
      router.push('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 pb-4">
        <h1 className="text-xl font-bold">Вход в Quizzty</h1>

        <Logo className="row-span-2 h-8 self-start text-primary" />

        <p className="text-sm text-muted-foreground">Введите данные для входа</p>
      </CardHeader>

      <form ref={formRef} onSubmit={(e) => void onSubmit(e)} noValidate>
        <CardContent className="flex flex-col gap-4">
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
              placeholder="••••••"
              aria-invalid={!!errors.password}
              onBlur={() => onBlur('password')}
              onChange={() => onChange('password')}
            />

            <FieldError message={errors.password} />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={!isValid || isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Войти
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Нет аккаунта?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
