import * as React from 'react';

import { cn } from '@/lib/utils';

/** Skinned to the export's `.fld` field treatment (the "Optional message" box). */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[56px] w-full resize-none rounded-12 border border-gty-border-2 bg-gty-surface-3 px-4 py-[13px] text-13-5 text-gty-ink placeholder:text-gty-placeholder transition-[border-color] duration-gty-fast ease-gty focus-visible:border-gty-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-gty-primary',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
