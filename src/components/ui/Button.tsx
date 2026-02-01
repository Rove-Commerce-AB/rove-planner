import { forwardRef, cloneElement, Children, isValidElement } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: React.ReactNode;
  asChild?: boolean;
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    `bg-brand-signal text-text-inverse hover:opacity-90 ${focusRing}`,
  secondary:
    `border border-border bg-bg-default text-text-primary hover:bg-bg-muted ${focusRing}`,
  danger: `bg-danger text-text-inverse hover:opacity-90 ${focusRing}`,
  ghost:
    `text-text-primary hover:bg-bg-muted ${focusRing}`,
};

const baseClasses = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50";

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", className = "", children, disabled, asChild, ...props }, ref) => {
    const combinedClassName = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

    if (asChild) {
      const child = Children.only(children);
      if (isValidElement(child)) {
        return cloneElement(child as React.ReactElement<{ className?: string }>, {
          className: [combinedClassName, (child.props as { className?: string }).className].filter(Boolean).join(" "),
        });
      }
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={combinedClassName}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
