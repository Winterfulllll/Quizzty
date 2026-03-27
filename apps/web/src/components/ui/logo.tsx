import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LogoFull } from '@/components/icons/logo-full';
import { LogoIcon } from '@/components/icons/logo-icon';

interface LogoProps {
  variant?: 'full' | 'icon';
  className?: string;
  href?: string;
}

export function Logo({ variant = 'icon', className, href = '/' }: LogoProps) {
  const Svg = variant === 'full' ? LogoFull : LogoIcon;

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center text-foreground transition-opacity hover:opacity-80',
        className,
      )}
    >
      <Svg className="h-full w-auto" />
    </Link>
  );
}
