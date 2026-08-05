import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";

export const dynamic = "force-dynamic";

function gradeFor(score, total) {
  const pct = (score / total) * 100;
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  return "F";
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Competition ranking (ties share the same rank): [{id, value}] -> Map(id -> rank)
function rankMap(entries) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const map = new Map();
  let rank = 1;
  sorted.forEach((entry, i) => {
    if (i > 0 && entry.value < sorted[i - 1].value) rank = i + 1;
    map.set(entry.id, rank);
  });
  return { map, outOf: sorted.length };
}

function subjectTotal(t) {
  const ca = (t?.["Class Exercise/Assignment"]?.score || 0) + (t?.["Mid-term"]?.score || 0);
  const exam = t?.["End-of-term"]?.score || 0;
  const hasAny = t?.["Class Exercise/Assignment"] || t?.["Mid-term"] || t?.["End-of-term"];
  return hasAny ? ca + exam : 0;
}

export default async function ReportCardPage({ searchParams }) {
  const supabase = createClient();
  const selectedStudentId = searchParams?.studentId;
  const selectedTerm = searchParams?.term || "Term 1";

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, classroom_id, classrooms(section, academic_levels(name))")
    .eq("status", "active")
    .order("full_name");

  let studentInfo = null;
  let subjectRows = [];
  let overallTotal = null;
  let overallPosition = null;
  let classSize = 0;

  if (selectedStudentId) {
    studentInfo = (students || []).find((s) => s.id === selectedStudentId);

    if (studentInfo) {
      const classroomId = studentInfo.classroom_id;

      const { data: exams } = await supabase
        .from("exams")
        .select("id, subject_name, exam_type, total_marks")
        .eq("classroom_id", classroomId)
        .eq("term", selectedTerm);

      const examIds = (exams || []).map((e) => e.id);
      const subjects = [...new Set((exams || []).map((e) => e.subject_name))];

      const { data: classmates } = await supabase
        .from("students")
        .select("id, full_name")
        .eq("classroom_id", classroomId)
        .eq("status", "active");
      classSize = (classmates || []).length;

      let allResults = [];
      if (examIds.length > 0) {
        const { data: resultsData } = await supabase
          .from("results")
          .select("student_id, score, exams(subject_name, exam_type, total_marks)")
          .in("exam_id", examIds);
        allResults = resultsData || [];
      }

      const studentTotals = {};
      allResults.forEach((r) => {
        const sid = r.student_id;
        const subj = r.exams.subject_name;
        if (!studentTotals[sid]) studentTotals[sid] = {};
        if (!studentTotals[sid][subj]) studentTotals[sid][subj] = {};
        studentTotals[sid][subj][r.exams.exam_type] = { score: r.score };
      });

      subjectRows = subjects.map((subject) => {
        const entries = (classmates || []).map((c) => ({
          id: c.id,
          value: subjectTotal(studentTotals[c.id]?.[subject]),
        }));
        const { map, outOf } = rankMap(entries);
        const t = studentTotals[selectedStudentId]?.[subject];
        const total = subjectTotal(t);
        return {
          subject,
          ca: (t?.["Class Exercise/Assignment"]?.score || 0) + (t?.["Mid-term"]?.score || 0),
          exam: t?.["End-of-term"]?.score ?? null,
          total,
          grade: total > 0 ? gradeFor(total, 100) : "—",
          position: map.get(selectedStudentId) ? ordinal(map.get(selectedStudentId)) : "—",
          outOf,
        };
      });

      const overallEntries = (classmates || []).map((c) => {
        const value = subjects.reduce((sum, subj) => sum + subjectTotal(studentTotals[c.id]?.[subj]), 0);
        return { id: c.id, value };
      });
      const { map: overallMap } = rankMap(overallEntries);
      overallTotal = subjectRows.reduce((sum, r) => sum + r.total, 0);
      overallPosition = overallMap.get(selectedStudentId)
        ? ordinal(overallMap.get(selectedStudentId))
        : "—";
    }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Report card</h1>
        <p className="text-stone-500 text-sm mb-6">
          View a student's grades, subject positions, and overall class position for the term.
        </p>

        <form method="GET" className="flex flex-wrap gap-3 mb-6">
          <AutoSubmitSelect
            name="studentId"
            defaultValue={selectedStudentId || ""}
            className="flex-1 min-w-[200px] rounded-lg border border-stone-300 px-3 py-2 text-sm"
            options={[
              { value: "", label: "Select a student", disabled: true },
              ...(students || []).map((s) => ({
                value: s.id,
                label: `${s.full_name} — ${s.classrooms?.academic_levels?.name} ${s.classrooms?.section}`,
              })),
            ]}
          />
          <AutoSubmitSelect
            name="term"
            defaultValue={selectedTerm}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
            options={[
              { value: "Term 1", label: "Term 1" },
              { value: "Term 2", label: "Term 2" },
              { value: "Term 3", label: "Term 3" },
            ]}
          />
        </form>

        {studentInfo && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="p-4 border-b border-stone-100">
                <p className="font-display text-lg font-semibold text-ink">{studentInfo.full_name}</p>
                <p className="text-xs text-stone-400">
                  {studentInfo.classrooms?.academic_levels?.name} {studentInfo.classrooms?.section} ·{" "}
                  {selectedTerm} · Class size: {classSize}
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Subject</th>
                    <th className="text-center px-4 py-2 font-medium">CA (30)</th>
                    <th className="text-center px-4 py-2 font-medium">Exam (70)</th>
                    <th className="text-center px-4 py-2 font-medium">Total</th>
                    <th className="text-center px-4 py-2 font-medium">Grade</th>
                    <th className="text-center px-4 py-2 font-medium">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectRows.map((r) => (
                    <tr key={r.subject} className="border-t border-stone-100">
                      <td className="px-4 py-2 text-ink">{r.subject}</td>
                      <td className="px-4 py-2 text-center text-stone-500">{r.ca || "—"}</td>
                      <td className="px-4 py-2 text-center text-stone-500">
                        {r.exam !== null ? r.exam : "—"}
                      </td>
                      <td className="px-4 py-2 text-center font-medium text-ink">{r.total || "—"}</td>
                      <td className="px-4 py-2 text-center font-mono font-bold text-pine">{r.grade}</td>
                      <td className="px-4 py-2 text-center text-stone-500">
                        {r.position} of {r.outOf}
                      </td>
                    </tr>
                  ))}
                  {subjectRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                        No results recorded for this term yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {subjectRows.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">Overall total</p>
                  <p className="text-xs text-stone-400">Sum across {subjectRows.length} subject(s)</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-semibold text-ink">{overallTotal}</p>
                  <p className="text-xs text-slateblue font-medium">
                    {overallPosition} of {classSize} in class
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedStudentId && (
          <p className="text-sm text-stone-400">Select a student above to view their report card.</p>
        )}
      </main>
    </div>
  );
}
