import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

interface HeaderProps {
  title: string;
  subtitle?: string;
  homeHref?: string;
  showSignOut?: boolean;
}

export function Header({ title, subtitle, homeHref = "/dashboard", showSignOut = true }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5">
        <Link href={homeHref} className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg text-white">
            🎓
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-brand-900">{title}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </Link>
        {showSignOut && <SignOutButton />}
      </div>
    </header>
  );
}
