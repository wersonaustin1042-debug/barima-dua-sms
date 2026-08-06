import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { createStaffUser, linkParentToChild, assignTeacherToClassroom } from "./actions";

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
        <form action={createStaffUser} className="bg-white rounded-xl border border-stone-200 p-4 space-y-3 mb-6">
          <p className="text-sm font-medium text-ink">Create a new login</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-500">Full name</label>
              <input name="fullName" required className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-500">Email</label>
              <input name="email" type="email" required className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Password</label>
              <input name="password" type="text" required minLength={6} placeholder="min 6 characters" className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">Phone (optional)</label>
              <input name="phone" className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-stone-500">Role</label>
              <select name="role" required className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm">
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
                <option value="accountant">Accountant</option>
                <option value="assistant_headmaster">Assistant Headmaster</option>
                <option value="headmaster">Headmaster</option>
                <option value="director">Director</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">If Teacher — assign class (optional)</label>
              <select name="classroomId" className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm">
                <option value="">— none —</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.academic_levels.name} {c.section}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500">If Parent — link to child (optional)</label>
              <select name="studentId" className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm">
                <option value="">— none —</option>
                {(students || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="bg-pine text-paper text-sm font-medium px-4 py-2 rounded-lg hover:bg-pine/90">
            Create login
          </button>
        </form>

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
