"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";

type Props = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label?: string;
  labelClassName?: string;
  tone?: "brand" | "success";
};

export function Switch({
  label,
  labelClassName = "",
  id,
  className = "",
  tone = "brand",
  ...props
}: Props) {
  const checkedTone =
    tone === "success"
      ? "data-[state=checked]:bg-status-success"
      : "data-[state=checked]:bg-brand-signal";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <SwitchPrimitive.Root
        id={id}
        className={`group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checkedTone}`}
        {...props}
      >
        <SwitchPrimitive.Thumb className="ds-shadow-xs pointer-events-none inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white ring-0 transition group-data-[state=checked]:translate-x-5" />
      </SwitchPrimitive.Root>
      {label && (
        <label
          htmlFor={id}
          className={`text-sm font-medium ${
            props.disabled ? "cursor-not-allowed" : "cursor-pointer"
          } ${labelClassName || "text-text-primary"}`}
        >
          {label}
        </label>
      )}
    </div>
  );
}
