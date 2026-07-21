import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { markAttendance } from "./actions";

export default async function AttendancePage({ searchParams }) {
  const supabase = createClient();
  const selectedClassroomId = searchParams?.classroomId;
  const today = new Date().toISOString().slice(0, 10);

  const { data: classroomsRaw } = await supabase
    .from("classrooms")
    .select("id, section, academic_levels(name, sort_order)");

  const classrooms = (classroomsRaw || []).sort(
    (a, b) =>
      a.academic_levels.sort_order - b.academic_levels.sort_order ||
      a.section.localeCompare(b.section)
  );

  let students = [];
  let attendanceMap = {};
  let activeClassroom = null;

  if (selectedClassroomId) {
    activeClassroom = classrooms.find((c) => c.id === selectedClassroomId);

    const { data: studentsData } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("classroom_id", selectedClassroomId)
      .eq("status", "active")
      .order("full_name");
    students = studentsData || [];

    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("student_id, status")
      .eq("classroom_id", selectedClassroomId)
      .eq("date", today);

    (attendanceData || []).forEach((a) => {
      attendanceMap[a.student_id] = a.status;
    });
  }

  const presentCount = Object.values(attendanceMap).filter((s) => s === "present").length;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Attendance register</h1>
        <p className="text-stone-500 text-sm mb-6">
          Pick a class, then stamp each student present or absent for today ({today}).
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {classrooms.length === 0 && (
            <p className="text-sm text-stone-400">
              No classes yet — enroll a student first and a class will appear here.
            </p>
          )}
          {classrooms.map((c) => (
            <Link
              key={c.id}
              href={`/attendance?classroomId=${c.id}`}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                c.id === selectedClassroomId
                  ? "bg-pine text-paper border-pine"
                  : "text-stone-500 border-stone-300 hover:border-pine/50"
              }`}
            >
              {c.academic_levels.name} {c.section}
            </Link>
          ))}
        </div>

        {activeClassroom && (
          <>
            <div className="flex items-center mb-3">
              <span className="text-sm font-medium text-ink">
                {activeClassroom.academic_levels.name} {activeClassroom.section}
              </span>
              <span className="text-xs text-stone-400 ml-auto">
                {presentCount}/{students.length} present
              </span>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
              {students.map((s) => {
                const status = attendanceMap[s.id];
                return (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3">
                    <p className="text-sm text-ink font-medium">{s.full_name}</p>
                    <div className="flex items-center gap-2">
                      <form action={markAttendance}>
                        <input type="hidden" name="studentId" value={s.id} />
                        <input type="hidden" name="classroomId" value={activeClassroom.id} />
                        <input type="hidden" name="status" value="present" />
                        <input type="hidden" name="currentStatus" value={status || ""} />
                        <button
                          type="submit"
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] font-mono text-sm font-bold
                            ${status === "present" ? "border-brass text-brass" : "border-dashed border-stone-300 text-stone-300"}`}
                        >
                          P
                        </button>
                      </form>
                      <form action={markAttendance}>
                        <input type="hidden" name="studentId" value={s.id} />
                        <input type="hidden" name="classroomId" value={activeClassroom.id} />
                        <input type="hidden" name="status" value="absent" />
                        <input type="hidden" name="currentStatus" value={status || ""} />
                        <button
                          type="submit"
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] font-mono text-sm font-bold
                            ${status === "absent" ? "border-clay text-clay" : "border-dashed border-stone-300 text-stone-300"}`}
                        >
                          A
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
              {students.length === 0 && (
                <p className="px-4 py-6 text-center text-stone-400 text-sm">No students in this class yet.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
