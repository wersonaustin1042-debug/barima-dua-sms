import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { linkParentToChild, assignTeacherToClassroom } from "./actions";
import CreateUserForm from "./CreateUserForm";

export const dynamic = "force-dynamic";

const ROLE_LABELS = {
  admin: "Admin",
  director: "Director",
  headmaster: "Headmaster",
  assistant_headmaster: "Assistant Headmaster",
  teacher: "Teacher",
  accountant: "Accountant",
  parent: "Parent",
};

export default async function UsersPage() {
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone, role")
    .order("full_name");

  const { data: classroomsRaw } = await supabase
    .from("classrooms")
    .select("id, section, class_teacher_id, academic_levels(name, sort_order)");
  const classrooms = (classroomsRaw || []).sort(
    (a, b) =>
      a.academic_levels.sort_order - b.academic_levels.sort_order ||
      a.section.localeCompare(b.section)
  );

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("status", "active")
    .order("full_name");

  const teachers = (profiles || []).filter((p) => p.role === "teacher");
  const parents = (profiles || []).filter((p) => p.role === "parent");

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Staff & parents</h1>
        <p className="text-stone-500 text-sm mb-6">
          Create logins for staff and parents, and assign teachers to classes.
        </p>

        {/* Create new user */}
        <CreateUserForm classrooms={classrooms} students={students || []} />

        {/* Link parent to another child */}
        <details className="mb-6">
          <summary className="text-xs text-stone-400 cursor-pointer">Link an existing parent to another child</summary>
          <form action={linkParentToChild} className="flex flex-wrap gap-2 mt-2">
            <select name="parentId" required className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
              <option value="">Select parent</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
            <select name="studentId" required className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
              <option value="">Select child</option>
              {(students || []).map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
            <button type="submit" className="text-xs font-medium bg-stone-700 text-white px-3 py-2 rounded-lg">
              Link
            </button>
          </form>
        </details>

        {/* Reassign a teacher's class */}
        <details className="mb-6">
          <summary className="text-xs text-stone-400 cursor-pointer">Assign / reassign a teacher's class</summary>
          <form action={assignTeacherToClassroom} className="flex flex-wrap gap-2 mt-2">
            <select name="teacherId" required className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
            <select name="classroomId" required className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
              <option value="">Select class</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>{c.academic_levels.name} {c.section}</option>
              ))}
            </select>
            <button type="submit" className="text-xs font-medium bg-stone-700 text-white px-3 py-2 rounded-lg">
              Assign
            </button>
          </form>
        </details>

        {/* Existing users list */}
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Role</th>
                <th className="text-left px-4 py-2 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody>
              {(profiles || []).map((p) => (
                <tr key={p.id} className="border-t border-stone-100">
                  <td className="px-4 py-2 text-ink">{p.full_name}</td>
                  <td className="px-4 py-2 text-stone-500">{ROLE_LABELS[p.role] || p.role}</td>
                  <td className="px-4 py-2 text-stone-500">{p.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
