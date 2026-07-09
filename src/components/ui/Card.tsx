// src/components/ui/Card.tsx — Conteneur carte réutilisable (enveloppe .card existant)
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ className, padded = true, children, ...props }: CardProps) {
  return (
    <div className={cn('card', padded && 'p-5', className)} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between px-5 py-4 border-b border-gray-100', className)}>
      <h3 className="font-semibold text-gray-800">{title}</h3>
      {action}
    </div>
  );
}
