import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";
import { saveTermInfo, saveRemarks } from "./actions";

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
  const selectedClassroomId = searchParams?.classroomId;
  const selectedTerm = searchParams?.term || "Term 1";
  const selectedStudentId = searchParams?.studentId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();

  const { data: classroomsRaw } = await supabase
    .from("classrooms")
    .select("id, section, class_teacher_id, academic_levels(name, sort_order)");
  let classrooms = (classroomsRaw || []).sort(
    (a, b) =>
      a.academic_levels.sort_order - b.academic_levels.sort_order ||
      a.section.localeCompare(b.section)
  );
  if (myProfile?.role === "teacher") {
    const { data: assigned } = await supabase
      .from("teacher_classrooms")
      .select("classroom_id")
      .eq("teacher_id", user.id);
    const ids = new Set((assigned || []).map((a) => a.classroom_id));
    classrooms = classrooms.filter((c) => ids.has(c.id));
  }

  const { data: termInfo } = await supabase.from("term_info").select("*").eq("term", selectedTerm).single();

  let classSummary = [];
  let activeClassroom = null;

  if (selectedClassroomId) {
    activeClassroom = classrooms.find((c) => c.id === selectedClassroomId);

    const { data: classmates } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("classroom_id", selectedClassroomId)
      .eq("status", "active")
      .order("full_name");

    const { data: exams } = await supabase
      .from("exams")
      .select("id, subject_name, exam_type")
      .eq("classroom_id", selectedClassroomId)
      .eq("term", selectedTerm);
    const examIds = (exams || []).map((e) => e.id);
    const subjects = [...new Set((exams || []).map((e) => e.subject_name))];

    let allResults = [];
    if (examIds.length > 0) {
      const { data: resultsData } = await supabase
        .from("results")
        .select("student_id, score, exams(subject_name, exam_type)")
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

    const overallEntries = (classmates || []).map((c) => {
      const value = subjects.reduce((sum, subj) => sum + subjectTotal(studentTotals[c.id]?.[subj]), 0);
      return { id: c.id, value };
    });
    const { map: overallMap, outOf } = rankMap(overallEntries);

    classSummary = (classmates || [])
      .map((c) => ({
        id: c.id,
        full_name: c.full_name,
        total: overallEntries.find((e) => e.id === c.id)?.value || 0,
        position: overallMap.get(c.id) ? ordinal(overallMap.get(c.id)) : "—",
        outOf,
      }))
      .sort((a, b) => b.total - a.total);
  }

  // ---- Detail view for one student ----
  let detail = null;
  if (selectedStudentId && activeClassroom) {
    const { data: studentInfo } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("id", selectedStudentId)
      .single();

    const { data: classmates } = await supabase
      .from("students")
      .select("id")
      .eq("classroom_id", selectedClassroomId)
      .eq("status", "active");
    const classSize = (classmates || []).length;

    const { data: exams } = await supabase
      .from("exams")
      .select("id, subject_name, exam_type")
      .eq("classroom_id", selectedClassroomId)
      .eq("term", selectedTerm);
    const examIds = (exams || []).map((e) => e.id);
    const subjects = [...new Set((exams || []).map((e) => e.subject_name))];

    let allResults = [];
    if (examIds.length > 0) {
      const { data: resultsData } = await supabase
        .from("results")
        .select("student_id, score, exams(subject_name, exam_type)")
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

    const subjectRows = subjects.map((subject) => {
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
    const overallTotal = subjectRows.reduce((sum, r) => sum + r.total, 0);
    const overallPosition = overallMap.get(selectedStudentId)
      ? ordinal(overallMap.get(selectedStudentId))
      : "—";

    // Attendance within term dates
    let presentDays = 0;
    let totalDays = 0;
    if (termInfo?.start_date && termInfo?.end_date) {
      const { data: attendance } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", selectedStudentId)
        .gte("date", termInfo.start_date)
        .lte("date", termInfo.end_date);
      totalDays = (attendance || []).length;
      presentDays = (attendance || []).filter((a) => a.status === "present").length;
    }

    // Fees
    const { data: plan } = await supabase
      .from("tuition_plans")
      .select("total_amount, amount_paid")
      .eq("student_id", selectedStudentId)
      .maybeSingle();
    const balance = plan ? Number(plan.total_amount) - Number(plan.amount_paid) : 0;

    const { data: remarks } = await supabase
      .from("term_remarks")
      .select("*")
      .eq("student_id", selectedStudentId)
      .eq("term", selectedTerm)
      .maybeSingle();

    detail = {
      studentInfo,
      classSize,
      subjectRows,
      overallTotal,
      overallPosition,
      presentDays,
      totalDays,
      balance,
      remarks,
      nextTermBill: remarks?.next_term_bill ?? "",
    };
  }

  const termOptions = [
    { value: "Term 1", label: "Term 1" },
    { value: "Term 2", label: "Term 2" },
    { value: "Term 3", label: "Term 3" },
  ];

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Report cards</h1>
        <p className="text-stone-500 text-sm mb-6">Pick a class to see the class list, then open a student's full report card.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {classrooms.map((c) => (
            <Link
              key={c.id}
              href={`/report-card?classroomId=${c.id}&term=${selectedTerm}`}
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
          <form method="GET" className="mb-4">
            <input type="hidden" name="classroomId" value={selectedClassroomId} />
            <AutoSubmitSelect
              name="term"
              defaultValue={selectedTerm}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              options={termOptions}
            />
          </form>
        )}

        {myProfile?.role && ["admin", "director", "headmaster", "assistant_headmaster"].includes(myProfile.role) && (
          <details className="mb-6">
            <summary className="text-xs text-stone-400 cursor-pointer">Set {selectedTerm} dates (vacation / reopening)</summary>
            <form action={saveTermInfo} className="flex flex-wrap gap-2 mt-2 items-end">
              <input type="hidden" name="term" value={selectedTerm} />
              <div>
                <label className="text-[10px] text-stone-400 block">Term starts</label>
                <input type="date" name="startDate" defaultValue={termInfo?.start_date || ""} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-stone-400 block">Vacation date</label>
                <input type="date" name="endDate" defaultValue={termInfo?.end_date || ""} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-stone-400 block">Reopening date</label>
                <input type="date" name="reopeningDate" defaultValue={termInfo?.reopening_date || ""} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm" />
              </div>
              <button type="submit" className="text-xs font-medium bg-stone-700 text-white px-3 py-2 rounded-lg">Save</button>
            </form>
          </details>
        )}

        {selectedClassroomId && !selectedStudentId && (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-center px-3 py-2 font-medium">Total</th>
                  <th className="text-center px-3 py-2 font-medium">Position</th>
                </tr>
              </thead>
              <tbody>
                {classSummary.map((s, i) => (
                  <tr key={s.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 text-stone-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/report-card?classroomId=${selectedClassroomId}&term=${selectedTerm}&studentId=${s.id}`}
                        className="text-ink font-medium hover:text-pine"
                      >
                        {s.full_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-center text-stone-600">{s.total || "—"}</td>
                    <td className="px-3 py-2 text-center text-stone-600">
                      {s.position} of {s.outOf}
                    </td>
                  </tr>
                ))}
                {classSummary.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-stone-400">No students in this class.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {detail && (
          <div className="bg-white rounded-xl border border-stone-200 p-5 print:shadow-none">
            <Link
              href={`/report-card?classroomId=${selectedClassroomId}&term=${selectedTerm}`}
              className="text-xs text-stone-400 hover:text-pine mb-4 inline-block"
            >
              ← Back to class list
            </Link>

            {/* Header */}
            <div className="text-center border-b border-stone-200 pb-4 mb-4">
              <img src="/logo.png" alt="" className="h-14 w-14 mx-auto mb-2 object-contain" />
              <p className="font-display text-xl font-semibold text-pine">Barima Dua Memorial School</p>
              <p className="text-xs text-stone-400">Creche — JHS 3</p>
              <p className="text-sm font-medium text-ink mt-2">Terminal Report Card</p>
            </div>

            {/* Student info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
              <p><span className="text-stone-400">Name:</span> <span className="font-medium text-ink">{detail.studentInfo?.full_name}</span></p>
              <p><span className="text-stone-400">Class:</span> <span className="font-medium text-ink">{activeClassroom.academic_levels.name} {activeClassroom.section}</span></p>
              <p><span className="text-stone-400">Term:</span> <span className="font-medium text-ink">{selectedTerm}</span></p>
              <p><span className="text-stone-400">Date issued:</span> <span className="font-medium text-ink">{new Date().toLocaleDateString()}</span></p>
              <p><span className="text-stone-400">Vacation date:</span> <span className="font-medium text-ink">{termInfo?.end_date || "—"}</span></p>
              <p><span className="text-stone-400">Reopening date:</span> <span className="font-medium text-ink">{termInfo?.reopening_date || "—"}</span></p>
            </div>

            {/* Subjects table */}
            <table className="w-full text-sm mb-4 border border-stone-200">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-2 py-1.5 border-b border-stone-200">#</th>
                  <th className="text-left px-2 py-1.5 border-b border-stone-200">Subject</th>
                  <th className="text-center px-2 py-1.5 border-b border-stone-200">CA(30)</th>
                  <th className="text-center px-2 py-1.5 border-b border-stone-200">Exam(70)</th>
                  <th className="text-center px-2 py-1.5 border-b border-stone-200">Total</th>
                  <th className="text-center px-2 py-1.5 border-b border-stone-200">Grade</th>
                  <th className="text-center px-2 py-1.5 border-b border-stone-200">Position</th>
                </tr>
              </thead>
              <tbody>
                {detail.subjectRows.map((r, i) => (
                  <tr key={r.subject} className="border-b border-stone-100">
                    <td className="px-2 py-1.5 text-stone-400">{i + 1}</td>
                    <td className="px-2 py-1.5 text-ink">{r.subject}</td>
                    <td className="px-2 py-1.5 text-center text-stone-500">{r.ca || "—"}</td>
                    <td className="px-2 py-1.5 text-center text-stone-500">{r.exam ?? "—"}</td>
                    <td className="px-2 py-1.5 text-center font-medium text-ink">{r.total || "—"}</td>
                    <td className="px-2 py-1.5 text-center font-mono font-bold text-pine">{r.grade}</td>
                    <td className="px-2 py-1.5 text-center text-stone-500">{r.position} of {r.outOf}</td>
                  </tr>
                ))}
                <tr className="bg-stone-50 font-medium">
                  <td colSpan={4} className="px-2 py-2 text-right text-ink">TOTAL</td>
                  <td className="px-2 py-2 text-center text-ink">{detail.overallTotal}</td>
                  <td></td>
                  <td className="px-2 py-2 text-center text-slateblue">{detail.overallPosition} of {detail.classSize}</td>
                </tr>
              </tbody>
            </table>

            {/* Attendance */}
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <div className="bg-stone-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-stone-400">Times present</p>
                <p className="font-medium text-ink">{detail.presentDays}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-stone-400">Total attendance</p>
                <p className="font-medium text-ink">{detail.totalDays}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-2 text-center">
                <p className="text-[10px] text-stone-400">Attendance %</p>
                <p className="font-medium text-ink">
                  {detail.totalDays > 0 ? Math.round((detail.presentDays / detail.totalDays) * 100) : "—"}
                  {detail.totalDays > 0 ? "%" : ""}
                </p>
              </div>
            </div>

            {/* Remarks form */}
            <form action={saveRemarks} className="space-y-3 mb-4">
              <input type="hidden" name="studentId" value={selectedStudentId} />
              <input type="hidden" name="term" value={selectedTerm} />
              <div>
                <label className="text-xs font-medium text-stone-500">Attitude / conduct</label>
                <input name="attitude" defaultValue={detail.remarks?.attitude || ""} className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500">Interests</label>
                <input name="interests" defaultValue={detail.remarks?.interests || ""} className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500">Class teacher's remarks</label>
                <textarea name="teacherRemarks" defaultValue={detail.remarks?.teacher_remarks || ""} rows={2} className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500">Headteacher's remarks</label>
                <textarea name="headteacherRemarks" defaultValue={detail.remarks?.headteacher_remarks || ""} rows={2} className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-200">
                <div>
                  <label className="text-xs font-medium text-stone-500">Debt as at vacation date</label>
                  <p className="mt-1 text-sm font-medium text-clay">GHS {detail.balance}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500">New bill for next term</label>
                  <input
                    type="number"
                    name="nextTermBill"
                    step="0.01"
                    defaultValue={detail.nextTermBill}
                    placeholder="0.00"
                    className="w-full mt-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2 bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-stone-400">Total termly bill to pay</p>
                  <p className="text-lg font-display font-semibold text-ink">
                    GHS {(detail.balance + Number(detail.nextTermBill || 0)).toFixed(2)}
                  </p>
                </div>
              </div>

              <button type="submit" className="bg-pine text-paper text-sm font-medium px-4 py-2 rounded-lg hover:bg-pine/90">
                Save remarks & billing
              </button>
            </form>

            {/* Signature */}
            <div className="pt-6 mt-4 border-t border-stone-200 flex justify-end">
              <div className="text-center">
                <div className="border-b border-stone-400 w-48 h-8"></div>
                <p className="text-xs text-stone-400 mt-1">Director's Signature</p>
              </div>
            </div>
          </div>
        )}

        {!selectedClassroomId && (
          <p className="text-sm text-stone-400">Select a class above to see the report card list.</p>
        )}
      </main>
    </div>
  );
}
