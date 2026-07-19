import Link from "next/link";
import type { ReactNode } from "react";
import { assetSrc } from "@/lib/utils";
import forkupLogo from "@/assets/forkup-logo.png";

export const headerPillClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/40";

const headerShellClass = "border-b border-border bg-background/80 backdrop-blur-md";

export function SiteHeaderLogo({
  href = "/",
  onClick,
}: {
  href?: string;
  onClick?: () => void;
}) {
  const image = (
    <img
      src={assetSrc(forkupLogo)}
      alt="ForkUp"
      width={232}
      height={100}
      className="h-12 w-auto object-contain"
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-80"
        aria-label="ForkUp home"
      >
        {image}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className="flex shrink-0 items-center rounded-lg transition-opacity hover:opacity-80"
      aria-label="ForkUp home"
    >
      {image}
    </Link>
  );
}

export function HeaderPillLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${headerPillClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function HeaderPillButton({
  onClick,
  children,
  type = "button",
  className = "",
}: {
  onClick: () => void;
  children: ReactNode;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} className={`${headerPillClass} ${className}`.trim()}>
      {children}
    </button>
  );
}

export function SiteHeader({
  sticky = true,
  logoHref,
  logoOnClick,
  leading,
  trailing,
  below,
}: {
  sticky?: boolean;
  logoHref?: string;
  logoOnClick?: () => void;
  leading?: ReactNode;
  trailing: ReactNode;
  below?: ReactNode;
}) {
  return (
    <header className={`${sticky ? "sticky top-0 z-50" : ""} ${headerShellClass}`}>
      <div className="mx-auto max-w-5xl px-5 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          {leading ?? <SiteHeaderLogo href={logoHref} onClick={logoOnClick} />}
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            {trailing}
          </div>
        </div>
        {below}
      </div>
    </header>
  );
}
