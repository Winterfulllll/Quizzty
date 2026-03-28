import { cn } from '@/lib/utils';

interface FieldErrorProps {
  message?: string;
  className?: string;
}

export function FieldError({ message, className }: FieldErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p className={cn('text-[13px] text-destructive', className)} role="alert">
      {message}
    </p>
  );
}
