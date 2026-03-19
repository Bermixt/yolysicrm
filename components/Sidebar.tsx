"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";

const NAV_ITEMS = [
  { label: "CSV Import", href: "/import" },
  { label: "Stores", href: "/stores" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const router = useRouter();

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700">
        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm tracking-tight">
          YolysiCRM
        </span>
      </div>

      <nav className="flex-1 p-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-slate-200 dark:border-slate-700">
        <button
          className="w-full text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          onClick={() => void signOut().then(() => router.push("/signin"))}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
