"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Only the homeroom teacher of a student's classroom (or an admin-like role)
// may touch that student's fees. A teacher merely assigned to teach the class
// isn't enough. The RLS policies in schema-homeroom-fees-and-service-optin.sql
// enforce this at the database level too, but that fails silently from the
// UI's point of view — so every write below checks explicitly first and
// bails out with nothing happening, the same "silently ignore" pattern
// setClassTeacher already uses elsewhere in this app.
async function canManageStudentFees(supabase, user, studentId) {
  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user?.id).single();
  if (myProfile?.role !== "teacher") return true; // admin-like / accountant — allowed
  const { data: student } = await supabase
    .from("students")
    .select("classrooms(class_teacher_id)")
    .eq("id", studentId)
    .single();
  return student?.classrooms?.class_teacher_id === user.id;
}

async function studentIdForFee(supabase, feeId) {
  const { data: fee } = await supabase.from("recurring_fees").select("student_id").eq("id", feeId).single();
  return fee?.student_id;
}

// Makes sure a student has a tuition plan and a combined canteen+transport
// fee row — but only if that student is actually signed up for it, so a
// student who opts out never shows a canteen/transport debt.
export async function ensureFeeSetup(studentId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await canManageStudentFees(supabase, user, studentId))) return;
  const { data: plan } = await supabase
    .from("tuition_plans")
    .select("student_id")
    .eq("student_id", studentId)
    .maybeSingle();
  if (!plan) {
    await supabase.from("tuition_plans").insert({ student_id: studentId, total_amount: 1200, amount_paid: 0 });
  }

  const { data: studentFlags } = await supabase
    .from("students")
    .select("takes_canteen_transport")
    .eq("id", studentId)
    .single();
  // Default on if the column hasn't synced yet for some reason.
  const takesCanteenTransport = studentFlags?.takes_canteen_transport !== false;

  const { data: existingFees } = await supabase
    .from("recurring_fees")
    .select("fee_type")
    .eq("student_id", studentId);
  const have = new Set((existingFees || []).map((f) => f.fee_type));

  if (takesCanteenTransport && !have.has("canteen_transport")) {
    await supabase.from("recurring_fees").insert({
      student_id: studentId,
      fee_type: "canteen_transport",
      frequency: "daily",
      amount: 10, // GHS 7 canteen + GHS 3 transport combined
    });
  }
}

// Toggle whether a student takes canteen & transport. Turning it OFF removes
// the fee row (and any recorded payments for it) so no balance or debt for
// it ever shows for this student again. Turning it back ON just lets
// ensureFeeSetup recreate a fresh row next time Fees is opened.
export async function setServiceFlags(formData) {
  const supabase = createClient();
  const studentId = formData.get("studentId");
  if (!studentId) return;
  const takesCanteenTransport = formData.get("takesCanteenTransport") === "on";

  await supabase
    .from("students")
    .update({ takes_canteen_transport: takesCanteenTransport })
    .eq("id", studentId);

  if (!takesCanteenTransport) {
    const { data: feesToRemove } = await supabase
      .from("recurring_fees")
      .select("id")
      .eq("student_id", studentId)
      .eq("fee_type", "canteen_transport");
    const feeIds = (feesToRemove || []).map((f) => f.id);
    if (feeIds.length > 0) {
      await supabase.from("recurring_fee_payments").delete().in("recurring_fee_id", feeIds);
      await supabase.from("recurring_fees").delete().in("id", feeIds);
    }
  }

  revalidatePath("/students");
  revalidatePath("/fees");
  revalidatePath("/fees-owing");
  revalidatePath("/parent");
}
export async function changeFrequency(formData) {
  const supabase = createClient();
  const feeId = formData.get("feeId");
  const frequency = formData.get("frequency");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const studentId = await studentIdForFee(supabase, feeId);
  if (!(await canManageStudentFees(supabase, user, studentId))) return;
  await supabase.from("recurring_fees").update({ frequency }).eq("id", feeId);
  revalidatePath("/fees");
}
// Saves a whole month's worth of canteen/transport amounts at once.
// Only touches rows that are actually new or actually changed, so
// recorded_by on untouched entries is never overwritten.
export async function saveRecurringMonth(formData) {
  const supabase = createClient();
  const feeId = formData.get("feeId");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const feeStudentId = await studentIdForFee(supabase, feeId);
  if (!(await canManageStudentFees(supabase, user, feeStudentId))) return;

  const { data: existingRows } = await supabase
    .from("recurring_fee_payments")
    .select("period_key, amount")
    .eq("recurring_fee_id", feeId);
  const existingByPeriod = {};
  (existingRows || []).forEach((r) => {
    existingByPeriod[r.period_key] = Number(r.amount);
  });

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amt__")) continue;
    const periodKey = key.replace("amt__", "");
    const hadExisting = periodKey in existingByPeriod;

    if (value === "") {
      if (hadExisting) {
        await supabase
          .from("recurring_fee_payments")
          .delete()
          .eq("recurring_fee_id", feeId)
          .eq("period_key", periodKey);
      }
      continue;
    }

    const newAmount = Number(value);
    if (hadExisting && existingByPeriod[periodKey] === newAmount) {
      // Unchanged — leave the row (and its original recorded_by) alone.
      continue;
    }

    await supabase.from("recurring_fee_payments").upsert(
      { recurring_fee_id: feeId, period_key: periodKey, amount: newAmount, recorded_by: user?.id },
      { onConflict: "recurring_fee_id,period_key" }
    );
  }
  revalidatePath("/fees");
}
// Saves a whole month's worth of tuition payments (one entry per day) at once.
// Only touches rows that are actually new or actually changed, so
// recorded_by on untouched entries is never overwritten.
export async function saveTuitionMonth(formData) {
  const supabase = createClient();
  const studentId = formData.get("studentId");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await canManageStudentFees(supabase, user, studentId))) return;

  const { data: existingRows } = await supabase
    .from("tuition_payments")
    .select("paid_on, amount")
    .eq("student_id", studentId);
  const existingByDate = {};
  (existingRows || []).forEach((r) => {
    existingByDate[r.paid_on] = Number(r.amount);
  });

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amt__")) continue;
    const dateIso = key.replace("amt__", "");
    const hadExisting = dateIso in existingByDate;

    if (value === "") {
      if (hadExisting) {
        await supabase.from("tuition_payments").delete().eq("student_id", studentId).eq("paid_on", dateIso);
      }
      continue;
    }

    const newAmount = Number(value);
    if (hadExisting && existingByDate[dateIso] === newAmount) {
      // Unchanged — leave the row (and its original recorded_by) alone.
      continue;
    }

    await supabase.from("tuition_payments").upsert(
      { student_id: studentId, paid_on: dateIso, amount: newAmount, recorded_by: user?.id },
      { onConflict: "student_id,paid_on" }
    );
  }
  // Recompute the running total from the ledger, so it never drifts
  const { data: payments } = await supabase
    .from("tuition_payments")
    .select("amount")
    .eq("student_id", studentId);
  const total = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  await supabase.from("tuition_plans").update({ amount_paid: total }).eq("student_id", studentId);
  revalidatePath("/fees");
}
