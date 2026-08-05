import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { findOrCreateExam, saveResults } from "./actions";

export const dynamic = "force-dynamic";

export default async function GradesPage({ searchParams }) {
  const supabase = createClient();
  const selectedClassroomId = searchParams?.classroomId;
  const selectedExamId = searchParams?.examId;

  const { data: classroomsRaw } = await supabase
    .from("classrooms")
    .select("id, section, academic_levels(name, sort_order)");
  const classrooms = (classroomsRaw || []).sort(
    (a, b) =>
      a.academic_levels.sort_order - b.academic_levels.sort_order ||
      a.section.localeCompare(b.section)
  );

  let students = [];
  let exams = [];
  let activeExam = null;
  let existingScores = {};

  if (selectedClassroomId) {
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("classroom_id", selectedClassroomId)
      .eq("status", "active")
      .order("full_name");
    students = studentsData || [];

    const { data: examsData } = await supabase
      .from("exams")
      .select("id, subject_name, term, exam_type, total_marks")
      .eq("classroom_id", selectedClassroomId)
      .order("created_at", { ascending: false });
    exams = examsData || [];
  }

  if (selectedExamId) {
    activeExam = exams.find((e) => e.id === selectedExamId);
    const { data: resultsData } = await supabase
      .from("results")
      .select("student_id, score, grade")
      .eq("exam_id", selectedExamId);
    (resultsData || []).forEach((r) => {
      existingScores[r.student_id] = r;
    });
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Grades</h1>
        <p className="text-stone-500 text-sm mb-6">Enter marks per subject, term, and exam type.</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {classrooms.map((c) => (
            <Link
              key={c.id}
              href={`/grades?classroomId=${c.id}`}
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

        {selectedClassroomId && (
          <>
            <form
              action={findOrCreateExam}
              className="bg-white rounded-xl border border-stone-200 p-4 space-y-3 mb-6"
            >
              <input type="hidden" name="classroomId" value={selectedClassroomId} />
              <p className="text-sm font-medium text-ink">New / existing exam</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-stone-500">Subject</label>
                  <input
                    name="subjectName"
                    required
                    placeholder="e.g. Mathematics"
                    className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500">Term</label>
                  <select name="term" required className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm">
                    <option>Term 1</option>
                    <option>Term 2</option>
                    <option>Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500">Exam type</label>
                  <select name="examType" required className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm">
                    <option value="Class Exercise/Assignment">Class Exercise/Assignment (10)</option>
                    <option value="Mid-term">Mid-term (20)</option>
                    <option value="End-of-term">End-of-term (70)</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="bg-pine text-paper text-sm font-medium px-4 py-2 rounded-lg hover:bg-pine/90"
              >
                Create / open exam
              </button>
            </form>

            {exams.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {exams.map((e) => (
                  <Link
                    key={e.id}
                    href={`/grades?classroomId=${selectedClassroomId}&examId=${e.id}`}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                      e.id === selectedExamId
                        ? "bg-slateblue text-paper border-slateblue"
                        : "text-stone-500 border-stone-300 hover:border-slateblue/50"
                    }`}
                  >
                    {e.subject_name} · {e.term} · {e.exam_type}
                  </Link>
                ))}
              </div>
            )}

            {activeExam && (
              <form action={saveResults} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <input type="hidden" name="examId" value={activeExam.id} />
                <input type="hidden" name="totalMarks" value={activeExam.total_marks} />
                <div className="p-4 border-b border-stone-100">
                  <p className="text-sm font-medium text-ink">
                    {activeExam.subject_name} — {activeExam.term}, {activeExam.exam_type}
                  </p>
                  <p className="text-xs text-stone-400">Out of {activeExam.total_marks} marks</p>
                </div>
                <div className="divide-y divide-stone-100">
                  {students.map((s) => {
                    const existing = existingScores[s.id];
                    return (
                      <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-3">
                        <p className="text-sm text-ink">{s.full_name}</p>
                        <div className="flex items-center gap-2">
                          {existing?.grade && (
                            <span className="text-xs font-mono font-bold text-pine">{existing.grade}</span>
                          )}
                          <input
                            type="number"
                            name={`score_${s.id}`}
                            step="0.5"
                            min="0"
                            max={activeExam.total_marks}
                            defaultValue={existing?.score ?? ""}
                            placeholder="score"
                            className="w-20 rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-right"
                          />
                        </div>
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <p className="px-4 py-6 text-center text-stone-400 text-sm">No students in this class.</p>
                  )}
                </div>
                <div className="p-4">
                  <button
                    type="submit"
                    className="bg-pine text-paper text-sm font-medium px-4 py-2 rounded-lg hover:bg-pine/90"
                  >
                    Save marks
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
