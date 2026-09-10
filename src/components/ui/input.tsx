import * as React from 'react';

import { cn } from '@/lib/utils';

/** Skinned to the export's `.fld` field treatment. */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex min-h-[44px] w-full rounded-12 border border-gty-border-2 bg-gty-surface-3 px-4 py-[13px] text-13-5 text-gty-ink placeholder:text-gty-placeholder transition-[border-color] duration-gty-fast ease-gty focus-visible:border-gty-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-gty-primary',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
