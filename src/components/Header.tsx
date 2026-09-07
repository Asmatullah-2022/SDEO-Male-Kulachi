import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

interface HeaderProps {
  title: string;
  subtitle?: string;
  homeHref?: string;
  showSignOut?: boolean;
  /** Admin pages have no bottom nav (headteacher pages already get a
   * Profile tab there), so this adds a small link to /admin/profile here
   * instead — a dedicated route, separate from the headteacher /profile. */
  showProfileLink?: boolean;
}

export function Header({
  title,
  subtitle,
  homeHref = "/dashboard",
  showSignOut = true,
  showProfileLink = false,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5">
        <Link href={homeHref} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
            <Image src="/logo.png" alt="SDEO Male Kulachi" width={36} height={36} className="h-full w-full object-contain" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-brand-900">{title}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </Link>
        <div className="flex items-center gap-1">
          {showProfileLink && (
            <Link
              href="/admin/profile"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              👤 Profile
            </Link>
          )}
          {showSignOut && <SignOutButton />}
        </div>
      </div>
    </header>
  );
}
