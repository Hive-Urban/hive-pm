"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Users, Grid3x3, FolderKanban, Settings } from "lucide-react";

const TABS = [
  { href: "/team",   label: "Team",   icon: Users },
  { href: "/matrix", label: "Matrix", icon: Grid3x3 },
  { href: "/repos",  label: "Repos",  icon: FolderKanban },
  { href: "/admin",  label: "Admin",  icon: Settings },
] as const;

export default function TopNav() {
  const pathname = usePathname();
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link href="/team" className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold tracking-widest text-indigo-500">HIVE</span>
          <span className="text-sm font-bold text-gray-900">R&amp;D</span>
        </Link>
        <nav className="flex items-center gap-1">
          {TABS.map(t => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            const Icon = t.icon;
            return (
              <Link key={t.href} href={t.href}
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}>
                <Icon size={14} />
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto" />
      </div>
    </header>
  );
}
