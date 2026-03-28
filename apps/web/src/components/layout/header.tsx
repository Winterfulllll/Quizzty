'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/ui/logo';

export function Header() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function handleLogout() {
    await logout();
    setLogoutOpen(false);
    router.push('/');
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo variant="full" className="h-6.5" />

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {isLoading ? null : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'gap-2' })}
                >
                  <Avatar className="size-6">
                    <AvatarImage src={user.avatar ?? undefined} />

                    <AvatarFallback className="text-xs">
                      {user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <span className="hidden sm:inline">{user.username}</span>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.username}</p>

                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => router.push('/profile')}>
                    <User className="mr-2 size-4" />
                    Личный кабинет
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLogoutOpen(true)} variant="destructive">
                    <LogOut className="mr-2 size-4" />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  Войти
                </Link>

                <Link href="/register" className={buttonVariants({ size: 'sm' })}>
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogPopup>
          <AlertDialogTitle>Выйти из аккаунта?</AlertDialogTitle>

          <AlertDialogDescription>
            Вы уверены, что хотите выйти? Вам потребуется снова войти для доступа к аккаунту.
          </AlertDialogDescription>

          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              Отмена
            </AlertDialogClose>

            <Button variant="destructive" size="sm" onClick={() => void handleLogout()}>
              Выйти
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
