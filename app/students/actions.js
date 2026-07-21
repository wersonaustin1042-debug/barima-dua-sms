"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function enrollStudent(formData) {
  const supabase = createClient();

  const fullName = formData.get("fullName");
  const levelId = formData.get("levelId");
  const section = formData.get("section");
  const dob = formData.get("dob") || null;

  // Find or create the classroom for this level + section
  let { data: classroom } = await supabase
    .from("classrooms")
    .select("id")
    .eq("level_id", levelId)
    .eq("section", section)
    .single();

  if (!classroom) {
    const { data: newClassroom, error: classroomError } = await supabase
      .from("classrooms")
      .insert({ level_id: levelId, section })
      .select("id")
      .single();
    if (classroomError) throw new Error(classroomError.message);
    classroom = newClassroom;
  }

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      full_name: fullName,
      classroom_id: classroom.id,
      date_of_birth: dob,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Every student starts with a tuition plan so Fees works immediately
  await supabase.from("tuition_plans").insert({ student_id: student.id });

  revalidatePath("/students");
  revalidatePath("/dashboard");
}
