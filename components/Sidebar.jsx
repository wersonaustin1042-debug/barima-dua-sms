"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/students", label: "Enrollment" },
  { href: "/attendance", label: "Attendance" },
  { href: "/fees", label: "Fees" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden sm:flex flex-col w-56 shrink-0 border-r border-stone-200 min-h-screen p-4">
      <div className="mb-8 px-2">
        <p className="font-display text-lg font-semibold text-pine leading-tight">Barima Dua</p>
        <p className="text-[11px] text-stone-400 mt-0.5">Creche — JHS 3</p>
      </div>
      <nav className="space-y-1 flex-1">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === href ? "bg-pine text-paper" : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={signOut}
        className="text-sm text-stone-400 hover:text-clay text-left px-3 py-2"
      >
        Sign out
      </button>
    </aside>
  );
}
