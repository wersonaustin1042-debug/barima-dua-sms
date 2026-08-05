"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DEFAULT_TOTALS = {
  "Class Exercise/Assignment": 10,
  "Mid-term": 20,
  "End-of-term": 70,
};

function gradeFor(score, total) {
  const pct = (Number(score) / Number(total)) * 100;
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  return "F";
}

// Creates the exam if it doesn't exist yet, then redirects the page to it via query params
export async function findOrCreateExam(formData) {
  const supabase = createClient();
  const classroomId = formData.get("classroomId");
  const subjectName = formData.get("subjectName")?.trim();
  const term = formData.get("term");
  const examType = formData.get("examType");
  const totalMarks = DEFAULT_TOTALS[examType] || 100;

  if (!subjectName) return;

  await supabase.from("exams").upsert(
    {
      classroom_id: classroomId,
      subject_name: subjectName,
      term,
      exam_type: examType,
      total_marks: totalMarks,
    },
    { onConflict: "classroom_id,subject_name,term,exam_type" }
  );

  revalidatePath("/grades");
}

export async function saveResults(formData) {
  const supabase = createClient();
  const examId = formData.get("examId");
  const totalMarks = Number(formData.get("totalMarks"));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("score_") && value !== "") {
      const studentId = key.replace("score_", "");
      const score = Number(value);
      rows.push({
        exam_id: examId,
        student_id: studentId,
        score,
        grade: gradeFor(score, totalMarks),
        recorded_by: user?.id,
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from("results").upsert(rows, { onConflict: "exam_id,student_id" });
  }

  revalidatePath("/grades");
}
