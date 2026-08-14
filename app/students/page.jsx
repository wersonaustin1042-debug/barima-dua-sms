import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { enrollStudent, updateRemarks } from "./actions";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ searchParams }) {
  const supabase = createClient();
  const q = searchParams?.q || "";

  const { data: levels } = await supabase
    .from("academic_levels")
    .select("id, name, sort_order")
    .order("sort_order");

  let studentsQuery = supabase
    .from("students")
    .select("id, full_name, admission_date, remarks, classrooms(section, academic_levels(name, sort_order))")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (q) {
    studentsQuery = studentsQuery.ilike("full_name", `%${q}%`);
  }

  const { data: students } = await studentsQuery;

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
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-500">Guardian full name</label>
              <input
                name="guardianName"
                className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                placeholder="e.g. Kofi Adjei"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Guardian phone</label>
              <input
                name="guardianPhone"
                type="tel"
                className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                placeholder="e.g. 0244000000"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Relationship</label>
              <select name="guardianRelationship" className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm">
                <option value="">Select</option>
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
                <option value="Guardian">Guardian</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-500">Remarks (optional)</label>
              <textarea
                name="remarks"
                rows={2}
                className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                placeholder="Any notes about this student..."
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

        <form method="GET" className="flex gap-2 mb-4">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by student name..."
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-sm font-medium bg-stone-100 text-ink border border-stone-200"
          >
            Search
          </button>
          {q && (
            <a
              href="/students"
              className="px-3 py-2 rounded-lg text-sm font-medium text-stone-500 border border-stone-200"
            >
              Clear
            </a>
          )}
        </form>

        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Class</th>
                <th className="text-left px-4 py-2 font-medium">Admitted</th>
                <th className="text-left px-4 py-2 font-medium min-w-[220px]">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(students || []).map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 text-ink align-top">{s.full_name}</td>
                  <td className="px-4 py-2 text-stone-500 align-top">
                    {s.classrooms?.academic_levels?.name} {s.classrooms?.section}
                  </td>
                  <td className="px-4 py-2 text-stone-500 font-mono text-xs align-top">{s.admission_date}</td>
                  <td className="px-4 py-2 align-top">
                    <form action={updateRemarks} className="flex items-start gap-2">
                      <input type="hidden" name="studentId" value={s.id} />
                      <textarea
                        name="remarks"
                        rows={1}
                        defaultValue={s.remarks || ""}
                        placeholder="Add a note..."
                        className="flex-1 rounded-lg border border-stone-200 px-2 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        className="text-xs font-medium bg-stone-100 text-ink px-2 py-1 rounded-lg border border-stone-200 hover:bg-stone-200 shrink-0"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(!students || students.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-stone-400">
                    {q ? `No students matching "${q}".` : "No students enrolled yet."}
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
