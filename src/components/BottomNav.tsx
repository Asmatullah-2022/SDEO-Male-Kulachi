"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/submit-report", label: "Submit", icon: "📝" },
  { href: "/history", label: "History", icon: "📊" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 border-t border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-3">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${
                active ? "text-brand-700" : "text-gray-400"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
