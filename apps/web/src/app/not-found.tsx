import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24">
      <h1 className="text-6xl font-bold text-primary">404</h1>

      <p className="text-lg text-muted-foreground">Страница не найдена</p>

      <Link
        href="/"
        className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        На главную
      </Link>
    </div>
  );
}
