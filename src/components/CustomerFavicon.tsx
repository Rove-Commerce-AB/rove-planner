"use client";

import { useState } from "react";
import { InitialsAvatar } from "@/components/ui";
import { DEFAULT_CUSTOMER_COLOR } from "@/lib/constants";

export function getCustomerFaviconUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const hostname = new URL(normalizedUrl).hostname;
    if (!hostname) return null;

    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
  } catch {
    return null;
  }
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type Props = {
  name: string;
  url?: string | null;
  color?: string | null;
};

export function CustomerFavicon({ name, url, color }: Props) {
  const [imageError, setImageError] = useState(false);
  const faviconUrl = getCustomerFaviconUrl(url);

  if (faviconUrl && !imageError) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-default">
        {/* Favicons are loaded from the customer's public website domain. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconUrl}
          alt=""
          className="h-5 w-5 object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </span>
    );
  }

  if (color) {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-text-inverse"
        style={{ backgroundColor: color || DEFAULT_CUSTOMER_COLOR }}
        aria-hidden
      >
        {initialsFromName(name)}
      </span>
    );
  }

  return (
    <InitialsAvatar name={name} initials={initialsFromName(name)} size="sm" />
  );
}
