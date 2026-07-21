"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markAttendance(formData) {
  const supabase = createClient();
  const studentId = formData.get("studentId");
  const classroomId = formData.get("classroomId");
  const status = formData.get("status");
  const currentStatus = formData.get("currentStatus");
  const today = new Date().toISOString().slice(0, 10);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (currentStatus === status) {
    // tapping the same stamp again clears it
    await supabase.from("attendance").delete().eq("student_id", studentId).eq("date", today);
  } else {
    await supabase.from("attendance").upsert(
      {
        student_id: studentId,
        classroom_id: classroomId,
        date: today,
        status,
        recorded_by: user?.id,
      },
      { onConflict: "student_id,date" }
    );
  }

  revalidatePath("/attendance");
}
