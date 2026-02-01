"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";

type Props = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label?: string;
};

export function Switch({ label, id, className = "", ...props }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <SwitchPrimitive.Root
        id={id}
        className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 data-[state=checked]:bg-brand-signal disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        <SwitchPrimitive.Thumb className="pointer-events-none inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow ring-0 transition group-data-[state=checked]:translate-x-5" />
      </SwitchPrimitive.Root>
      {label && (
        <label
          htmlFor={id}
          className="cursor-pointer text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      )}
    </div>
  );
}
