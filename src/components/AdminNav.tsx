"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Overview", icon: "📈" },
  { href: "/admin/schools", label: "Schools", icon: "🏫" },
  { href: "/admin/users", label: "Users", icon: "👤" },
  { href: "/admin/reports", label: "Reports", icon: "📄" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-brand-100 bg-white">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold ${
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-brand-700"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
