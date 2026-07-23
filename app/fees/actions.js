"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function getPeriodKey(frequency, date = new Date()) {
  if (frequency === "daily") return date.toISOString().slice(0, 10);
  if (frequency === "weekly") {
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil(((date - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${week}`;
  }
  return date.toISOString().slice(0, 7); // monthly -> YYYY-MM
}

// Ensures a student has canteen + transport fee rows set up (defaults on first visit)
export async function ensureRecurringFees(studentId) {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("recurring_fees")
    .select("id, fee_type")
    .eq("student_id", studentId);

  const existingTypes = new Set((existing || []).map((r) => r.fee_type));
  const toCreate = [];
  if (!existingTypes.has("canteen")) {
    toCreate.push({ student_id: studentId, fee_type: "canteen", frequency: "weekly", amount: 20 });
  }
  if (!existingTypes.has("transport")) {
    toCreate.push({ student_id: studentId, fee_type: "transport", frequency: "monthly", amount: 60 });
  }
  if (toCreate.length > 0) {
    await supabase.from("recurring_fees").insert(toCreate);
  }
}

export async function recordInstallment(formData) {
  const supabase = createClient();
  const studentId = formData.get("studentId");
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: plan } = await supabase
    .from("tuition_plans")
    .select("total_amount, amount_paid")
    .eq("student_id", studentId)
    .single();

  if (!plan) return;

  const newPaid = Math.min(plan.total_amount, Number(plan.amount_paid) + amount);

  await supabase.from("tuition_plans").update({ amount_paid: newPaid }).eq("student_id", studentId);
  await supabase.from("tuition_payments").insert({
    student_id: studentId,
    amount,
    recorded_by: user?.id,
  });

  revalidatePath("/fees");
}

export async function changeFrequency(formData) {
  const supabase = createClient();
  const feeId = formData.get("feeId");
  const frequency = formData.get("frequency");

  await supabase.from("recurring_fees").update({ frequency }).eq("id", feeId);
  revalidatePath("/fees");
}

export async function recordRecurringPayment(formData) {
  const supabase = createClient();
  const feeId = formData.get("feeId");
  const frequency = formData.get("frequency");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const periodKey = getPeriodKey(frequency);

  await supabase.from("recurring_fee_payments").upsert(
    {
      recurring_fee_id: feeId,
      period_key: periodKey,
      recorded_by: user?.id,
    },
    { onConflict: "recurring_fee_id,period_key" }
  );

  revalidatePath("/fees");
}
