import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-primary-500',
    'bg-accent-500',
    'bg-success-500',
    'bg-warning-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-cyan-500',
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
}

export function Avatar({
  src,
  alt,
  name = '',
  size = 'md',
  className,
  ...props
}: AvatarProps) {
  if (src) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden',
          'ring-2 ring-[var(--bg-secondary)] ring-offset-2 ring-offset-[var(--bg-primary)]',
          sizes[size],
          className
        )}
        {...props}
      >
        <img
          src={src}
          alt={alt || name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full',
        'font-semibold text-white',
        'ring-2 ring-[var(--bg-secondary)] ring-offset-2 ring-offset-[var(--bg-primary)]',
        getColorFromName(name),
        sizes[size],
        className
      )}
      {...props}
    >
      {getInitials(name)}
    </div>
  );
}
