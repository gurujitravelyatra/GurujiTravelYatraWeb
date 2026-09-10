import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Skinned to the export's `.btn` / `.btn.p` treatments (globals.css tokens
 * only — no hardcoded hex/px). `primary` = `.btn.p`, `default` = `.btn`.
 */
const buttonVariants = cva(
  'inline-flex min-h-[42px] items-center justify-center gap-[9px] whitespace-nowrap rounded-pill border-[1.5px] px-5 py-3 text-11-5 font-bold tracking-btn transition-[background-color,border-color,color,box-shadow,transform] duration-gty-fast ease-gty active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        primary:
          'border-gty-primary bg-gty-primary text-gty-white shadow-gty-btn hover:-translate-y-px hover:border-gty-primary-deep hover:bg-gty-primary-deep hover:shadow-gty-btn-hover',
        default:
          'border-gty-border-9 bg-gty-white text-gty-ink hover:border-gty-primary hover:bg-gty-red-50 hover:text-gty-primary',
        ghost: 'border-transparent bg-transparent px-0 py-0 text-gty-ink hover:text-gty-primary',
      },
      size: {
        default: '',
        sm: 'min-h-[36px] px-4 py-2 text-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
