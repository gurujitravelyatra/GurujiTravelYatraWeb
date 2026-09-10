import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Standard shadcn-style className combinator: conditional classes + Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
