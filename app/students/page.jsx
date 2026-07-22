import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { enrollStudent } from "./actions";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const supabase = createClient();

  const { data: levels } = await supabase
    .from("academic_levels")
    .select("id, name, sort_order")
    .order("sort_order");

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, admission_date, classrooms(section, academic_levels(name, sort_order))")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-8 pb-24 sm:pb-8 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Enrollment</h1>
        <p className="text-stone-500 text-sm mb-6">Register a new student and assign them to a class.</p>

        <form action={enrollStudent} className="bg-white rounded-xl border border-stone-200 p-4 space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-500">Student full name</label>
              <input
                name="fullName"
                required
                className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pine/40"
                placeholder="e.g. Nana Adjei"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Level</label>
              <select name="levelId" required className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm">
                {(levels || []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Section</label>
              <select name="section" required className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm">
                <option>A</option>
                <option>B</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-500">Date of birth</label>
              <input
                name="dob"
                type="date"
                className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-pine text-paper text-sm font-medium px-4 py-2 rounded-lg hover:bg-pine/90"
          >
            Enroll student
          </button>
        </form>

        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Class</th>
                <th className="text-left px-4 py-2 font-medium">Admitted</th>
              </tr>
            </thead>
            <tbody>
              {(students || []).map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 text-ink">{s.full_name}</td>
                  <td className="px-4 py-2 text-stone-500">
                    {s.classrooms?.academic_levels?.name} {s.classrooms?.section}
                  </td>
                  <td className="px-4 py-2 text-stone-500 font-mono text-xs">{s.admission_date}</td>
                </tr>
              ))}
              {(!students || students.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-stone-400">
                    No students enrolled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
