"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ADMIN_LIKE = ["admin", "director", "headmaster", "assistant_headmaster"];

const ALL_NAV = [
  { href: "/dashboard", label: "Dashboard", roles: [...ADMIN_LIKE, "accountant"] },
  { href: "/students", label: "Enrollment", roles: ADMIN_LIKE },
  { href: "/attendance", label: "Attendance", roles: [...ADMIN_LIKE, "teacher"] },
  { href: "/grades", label: "Grades", roles: [...ADMIN_LIKE, "teacher"] },
  { href: "/report-card", label: "Report card", roles: [...ADMIN_LIKE, "teacher"] },
  { href: "/fees", label: "Fees", roles: [...ADMIN_LIKE, "accountant"] },
  { href: "/users", label: "Staff & parents", roles: ADMIN_LIKE },
  { href: "/parent", label: "My children", roles: ["parent"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [role, setRole] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (active && profile) setRole(profile.role);
    }
    loadRole();
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = role ? ALL_NAV.filter((item) => item.roles.includes(role)) : [];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-56 shrink-0 border-r border-stone-200 min-h-screen p-4">
        <div className="mb-8 px-2">
          <p className="font-display text-lg font-semibold text-pine leading-tight">Barima Dua</p>
          <p className="text-[11px] text-stone-400 mt-0.5">Creche — JHS 3</p>
        </div>
        <nav className="space-y-1 flex-1">
          {nav.map(({ href, label }) => (
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
        <button onClick={signOut} className="text-sm text-stone-400 hover:text-clay text-left px-3 py-2">
          Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="sm:hidden sticky top-0 z-20 bg-paper border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <p className="font-display text-base font-semibold text-pine leading-tight">Barima Dua</p>
        <button onClick={signOut} className="text-xs text-stone-400">
          Sign out
        </button>
      </div>

      {/* Mobile scrollable nav */}
      <nav className="sm:hidden sticky top-[49px] z-20 bg-white border-b border-stone-200 flex overflow-x-auto gap-1 px-3 py-2">
        {nav.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
              pathname === href ? "bg-pine text-paper border-pine" : "text-stone-500 border-stone-300"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="sm:hidden h-2 shrink-0" />
    </>
  );
}
