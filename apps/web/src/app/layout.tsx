import type { Metadata } from 'next';
import { Montserrat, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthProvider } from '@/lib/auth';
import { Header } from '@/components/layout/header';
import './globals.css';

const montserrat = Montserrat({
  variable: '--font-sans',
  subsets: ['latin', 'cyrillic'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Quizzty — Квизы в реальном времени',
  description: 'Создавайте и проводите интерактивные квизы для любой аудитории',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${montserrat.variable} ${geistMono.variable}`}
    >
      <body className="min-h-svh bg-background font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <div className="relative flex min-h-svh flex-col">
              <Header />

              <main className="flex-1">{children}</main>
            </div>

            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
