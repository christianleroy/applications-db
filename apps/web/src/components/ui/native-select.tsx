import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A styled native <select>: keeps browser keyboard and mobile behaviour. */
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <div data-slot="native-select-wrapper" className="relative w-full has-[select:disabled]:opacity-50">
      <select
        data-slot="native-select"
        className={cn(
          'h-9 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-background py-1 pr-9 pl-3 text-sm transition-colors outline-none',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          'disabled:pointer-events-none disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      />
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
