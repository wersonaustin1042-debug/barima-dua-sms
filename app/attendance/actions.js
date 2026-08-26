"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function cycleAttendance(formData) {
  const supabase = createClient();
  const studentId = formData.get("studentId");
  const classroomId = formData.get("classroomId");
  const date = formData.get("date");
  const currentStatus = formData.get("currentStatus") || "";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only the homeroom teacher of this classroom (or an admin-like role) can
  // mark attendance here. Being assigned to teach the class isn't enough —
  // the page.jsx filtering already hides other classes, but this blocks a
  // teacher from reaching one by editing the request directly. The RLS
  // policy in schema-homeroom-fees-and-service-optin.sql would also block
  // the write, but that fails silently from the UI's point of view, so we
  // check explicitly here and bail out with nothing happening.
  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (myProfile?.role === "teacher") {
    const { data: classroom } = await supabase
      .from("classrooms")
      .select("class_teacher_id")
      .eq("id", classroomId)
      .single();
    if (classroom?.class_teacher_id !== user.id) {
      return; // not this teacher's homeroom — silently ignore, matching setClassTeacher's pattern
    }
  }

  // blank -> present -> absent -> blank
  let nextStatus = null;
  if (currentStatus === "") nextStatus = "present";
  else if (currentStatus === "present") nextStatus = "absent";
  else nextStatus = null;

  if (nextStatus === null) {
    await supabase.from("attendance").delete().eq("student_id", studentId).eq("date", date);
  } else {
    await supabase.from("attendance").upsert(
      { student_id: studentId, classroom_id: classroomId, date, status: nextStatus, recorded_by: user?.id },
      { onConflict: "student_id,date" }
    );
  }

  revalidatePath("/attendance");
}
