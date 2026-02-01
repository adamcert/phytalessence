import type { HTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'strong' | 'subtle';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  animate?: boolean;
}

const variants = {
  default: 'glass',
  strong: 'glass-strong',
  subtle: 'bg-[var(--bg-secondary)]/50 backdrop-blur-sm border border-[var(--border-primary)]/50',
};

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function GlassCard({
  children,
  variant = 'default',
  hover = false,
  padding = 'md',
  animate = true,
  className,
  ...props
}: GlassCardProps) {
  const Component = animate ? motion.div : 'div';

  const animationProps = animate
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 },
      }
    : {};

  return (
    <Component
      className={cn(
        'rounded-2xl',
        'shadow-lg',
        variants[variant],
        paddings[padding],
        hover && 'hover-lift cursor-pointer',
        className
      )}
      {...animationProps}
      {...props}
    >
      {children}
    </Component>
  );
}
