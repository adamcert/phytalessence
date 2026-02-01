import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative w-16 h-8 rounded-full p-1',
        'bg-[var(--bg-tertiary)]',
        'border border-[var(--border-primary)]',
        'transition-colors duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Track icons */}
      <div className="absolute inset-0 flex items-center justify-between px-2">
        <Sun
          className={cn(
            'w-4 h-4 transition-opacity duration-300',
            isDark ? 'opacity-30' : 'opacity-0'
          )}
        />
        <Moon
          className={cn(
            'w-4 h-4 transition-opacity duration-300',
            isDark ? 'opacity-0' : 'opacity-30'
          )}
        />
      </div>

      {/* Sliding thumb */}
      <motion.div
        className={cn(
          'w-6 h-6 rounded-full',
          'flex items-center justify-center',
          'shadow-md',
          isDark
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
            : 'bg-gradient-to-br from-amber-400 to-orange-500'
        )}
        animate={{
          x: isDark ? 32 : 0,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-white" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-white" />
        )}
      </motion.div>
    </button>
  );
}
