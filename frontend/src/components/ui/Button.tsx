import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

const variants = {
  primary: `
    bg-gradient-to-r from-primary-600 to-primary-500
    text-white
    shadow-md shadow-primary-500/20
    hover:shadow-lg hover:shadow-primary-500/30
    hover:from-primary-700 hover:to-primary-600
    active:scale-[0.98]
  `,
  secondary: `
    bg-[var(--bg-secondary)]
    text-[var(--text-primary)]
    border border-[var(--border-primary)]
    hover:bg-[var(--bg-tertiary)]
    hover:border-[var(--border-secondary)]
    active:scale-[0.98]
  `,
  outline: `
    bg-transparent
    text-primary-600
    border-2 border-primary-500
    hover:bg-primary-50
    dark:hover:bg-primary-900/20
    active:scale-[0.98]
  `,
  ghost: `
    bg-transparent
    text-[var(--text-secondary)]
    hover:bg-[var(--bg-tertiary)]
    hover:text-[var(--text-primary)]
    active:scale-[0.98]
  `,
  danger: `
    bg-gradient-to-r from-error-600 to-error-500
    text-white
    shadow-md shadow-error-500/20
    hover:shadow-lg hover:shadow-error-500/30
    hover:from-error-700 hover:to-error-600
    active:scale-[0.98]
  `,
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
