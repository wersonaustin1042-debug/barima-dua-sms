"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { generateTempPassword, ADMIN_LIKE_ROLES, TOP_ROLES } from "@/lib/passwords";

const CREATABLE_ROLES = ["teacher", "parent", "accountant", "assistant_headmaster", "headmaster", "director"];

// Who is calling this server action, and with what role. These actions use
// the service-role key, so they must check this themselves — the database's
// row-level security doesn't apply to the service-role client.
async function getCaller(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { user, role: profile?.role || null };
}

export async function createStaffUser(prevState, formData) {
  const supabase = createClient();
  const admin = createAdminClient();

  const caller = await getCaller(supabase);
  if (!caller.user || !ADMIN_LIKE_ROLES.includes(caller.role)) {
    return { error: "You don't have permission to create logins." };
  }

  const fullName = formData.get("fullName")?.trim();
  const email = formData.get("email")?.trim();
  const role = formData.get("role");
  const phone = formData.get("phone")?.trim() || null;
  const studentId = formData.get("studentId") || null;
  if (!fullName || !email || !role) {
    return { error: "Please fill in name, email, and role." };
  }
  if (!CREATABLE_ROLES.includes(role)) {
    return { error: "That role isn't allowed." };
  }
  if (TOP_ROLES.includes(role) && !TOP_ROLES.includes(caller.role)) {
    return { error: "Only an admin or director can create a director login." };
  }

  // The admin never picks the password. A random temporary one is made here,
  // shown once, and the person is forced to choose their own at first login
  // (middleware.js redirects them to /change-password until they do).
  const tempPassword = generateTempPassword();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { must_change_password: true },
  });
  if (error || !created?.user) {
    return { error: error?.message || "Could not create the login." };
  }
  const newUserId = created.user.id;
  const { error: profileError } = await supabase.from("profiles").insert({
    id: newUserId,
    full_name: fullName,
    phone,
    role,
  });
  if (profileError) {
    return { error: `Login created but profile failed: ${profileError.message}` };
  }
  if (role === "teacher") {
    const classroomIds = formData.getAll("classroomIds").filter(Boolean);
    if (classroomIds.length > 0) {
      await supabase
        .from("teacher_classrooms")
        .insert(classroomIds.map((id) => ({ teacher_id: newUserId, classroom_id: id })));
    }
  }
  if (role === "parent" && studentId) {
    await supabase.from("student_guardians").insert({ student_id: studentId, parent_id: newUserId });
  }
  revalidatePath("/users");
  return {
    success: `Created login for ${fullName}.`,
    tempPassword,
    tempEmail: email,
  };
}

// Gives someone a new temporary password (e.g. they forgot theirs) and forces
// them to choose their own again at next login. The admin sees the temporary
// one once, same as when creating an account.
export async function resetUserPassword(prevState, formData) {
  const supabase = createClient();
  const admin = createAdminClient();

  const caller = await getCaller(supabase);
  if (!caller.user || !ADMIN_LIKE_ROLES.includes(caller.role)) {
    return { error: "You don't have permission to reset passwords." };
  }

  const userId = formData.get("userId");
  if (!userId) return { error: "No user selected." };
  if (userId === caller.user.id) {
    return { error: "Use Change password in the menu for your own account." };
  }

  const { data: target } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (!target) return { error: "User not found." };
  if (TOP_ROLES.includes(target.role) && !TOP_ROLES.includes(caller.role)) {
    return { error: "Only an admin or director can reset that account." };
  }

  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    app_metadata: { must_change_password: true },
  });
  if (error) return { error: error.message };

  revalidatePath("/users");
  return { success: "New temporary password:", tempPassword };
}
// Links an existing parent account to another child (for parents with more than one kid at the school)
export async function linkParentToChild(formData) {
  const supabase = createClient();
  const parentId = formData.get("parentId");
  const studentId = formData.get("studentId");
  if (!parentId || !studentId) return;
  await supabase.from("student_guardians").insert({ student_id: studentId, parent_id: parentId });
  revalidatePath("/users");
}
export async function assignTeacherToClassrooms(formData) {
  const supabase = createClient();
  const teacherId = formData.get("teacherId");
  const classroomIds = formData.getAll("classroomIds").filter(Boolean);
  if (!teacherId || classroomIds.length === 0) return;
  // A plain insert is rejected as a whole if even one picked class is already
  // assigned to this teacher (primary key = teacher + classroom), so nothing
  // got saved and nothing was shown. Classes they already have are skipped
  // instead, and the rest go through.
  const { error } = await supabase
    .from("teacher_classrooms")
    .upsert(
      classroomIds.map((id) => ({ teacher_id: teacherId, classroom_id: id })),
      { onConflict: "teacher_id,classroom_id", ignoreDuplicates: true }
    );
  // Any other failure used to vanish silently; surface it.
  if (error) throw new Error(`Could not assign classes: ${error.message}`);
  revalidatePath("/users");
}
export async function unassignTeacherFromClassroom(formData) {
  const supabase = createClient();
  const teacherId = formData.get("teacherId");
  const classroomId = formData.get("classroomId");
  if (!teacherId || !classroomId) return;
  await supabase
    .from("teacher_classrooms")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("classroom_id", classroomId);
  revalidatePath("/users");
}
export async function setClassTeacher(formData) {
  const supabase = createClient();
  const classroomId = formData.get("classroomId");
  const teacherId = formData.get("teacherId") || null;
  if (!classroomId) return;

  if (teacherId) {
    // Block if this teacher is already homeroom teacher of a different classroom
    const { data: existing } = await supabase
      .from("classrooms")
      .select("id")
      .eq("class_teacher_id", teacherId)
      .neq("id", classroomId)
      .maybeSingle();
    if (existing) return; // already homeroom elsewhere — silently ignore
  }

  await supabase.from("classrooms").update({ class_teacher_id: teacherId }).eq("id", classroomId);
  revalidatePath("/users");
}

// Sets exactly which subjects a teacher is allowed to grade for one
// classroom they're assigned to — full replace of that (teacher, classroom)
// pair each time this is submitted.
export async function assignTeacherSubjects(formData) {
  const supabase = createClient();
  const teacherId = formData.get("teacherId");
  const classroomId = formData.get("classroomId");
  const subjectIds = formData.getAll("subjectIds").filter(Boolean);
  if (!teacherId || !classroomId) return;

  await supabase
    .from("teacher_subjects")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("classroom_id", classroomId);

  if (subjectIds.length > 0) {
    await supabase
      .from("teacher_subjects")
      .insert(subjectIds.map((subjectId) => ({ teacher_id: teacherId, classroom_id: classroomId, subject_id: subjectId })));
  }
  revalidatePath("/users");
}
