"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileSignature, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  matches: (pathname: string) => boolean;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    href: "/admin/applications",
    icon: Home,
    matches: (p) =>
      p === "/admin" ||
      p === "/admin/applications" ||
      p.startsWith("/admin/applications/"),
  },
  {
    label: "Offers",
    href: "/admin/offers",
    icon: FileSignature,
    matches: (p) => p === "/admin/offers" || p.startsWith("/admin/offers/"),
  },
  {
    label: "Recent Hires",
    href: "/admin/recent-hires",
    icon: Sparkles,
    matches: (p) => p.startsWith("/admin/recent-hires"),
  },
];

export function AdminSidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="sticky top-0 h-screen w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          N
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Niural</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Hiring console
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const active = item.matches(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-sidebar-accent-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
