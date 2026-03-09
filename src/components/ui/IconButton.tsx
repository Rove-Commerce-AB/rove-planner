"use client";

import { forwardRef } from "react";

type IconButtonVariant = "ghost" | "ghostDanger";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IconButtonVariant;
  "aria-label": string;
  children: React.ReactNode;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-signal focus-visible:ring-offset-2";

const variantClasses: Record<IconButtonVariant, string> = {
  ghost:
    "text-text-primary opacity-60 hover:opacity-100 hover:bg-bg-muted",
  ghostDanger:
    "text-text-primary opacity-60 hover:bg-danger/10 hover:text-danger",
};

const baseClasses =
  "cursor-pointer inline-flex items-center justify-center rounded-sm p-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed " +
  focusRing;

export const IconButton = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "ghost", className = "", ...props }, ref) => {
    const combinedClassName = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();
    return <button ref={ref} type="button" className={combinedClassName} {...props} />;
  }
);

IconButton.displayName = "IconButton";
