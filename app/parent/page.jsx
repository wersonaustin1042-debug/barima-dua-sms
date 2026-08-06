import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

function getPeriodKey(frequency, date = new Date()) {
  if (frequency === "daily") return date.toISOString().slice(0, 10);
  if (frequency === "weekly") {
    const jan1 = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil(((date - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${week}`;
  }
  return date.toISOString().slice(0, 7);
}

export default async function ParentPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: links } = await supabase
    .from("student_guardians")
    .select("student_id, students(id, full_name, classroom_id, classrooms(section, academic_levels(name)))")
    .eq("parent_id", user?.id);

  const children = (links || []).map((l) => l.students).filter(Boolean);

  const childData = [];
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  for (const child of children) {
    const { data: attendance } = await supabase
      .from("attendance")
      .select("status")
      .eq("student_id", child.id)
      .gte("date", monthStart);

    const presentDays = (attendance || []).filter((a) => a.status === "present").length;
    const totalDays = (attendance || []).length;

    const { data: plan } = await supabase
      .from("tuition_plans")
      .select("total_amount, amount_paid")
      .eq("student_id", child.id)
      .maybeSingle();

    const { data: fees } = await supabase
      .from("recurring_fees")
      .select("id, fee_type, frequency")
      .eq("student_id", child.id);

    let canteenPaid = null;
    let transportPaid = null;
    for (const fee of fees || []) {
      const periodKey = getPeriodKey(fee.frequency);
      const { data: payment } = await supabase
        .from("recurring_fee_payments")
        .select("id")
        .eq("recurring_fee_id", fee.id)
        .eq("period_key", periodKey)
        .maybeSingle();
      if (fee.fee_type === "canteen") canteenPaid = !!payment;
      if (fee.fee_type === "transport") transportPaid = !!payment;
    }

    childData.push({
      ...child,
      presentDays,
      totalDays,
      tuitionBalance: plan ? Number(plan.total_amount) - Number(plan.amount_paid) : null,
      canteenPaid,
      transportPaid,
    });
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">My children</h1>
        <p className="text-stone-500 text-sm mb-6">A quick view of attendance, tuition, and fees.</p>

        <div className="space-y-4">
          {childData.map((child) => (
            <div key={child.id} className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <div>
                <p className="font-display text-lg font-semibold text-ink">{child.full_name}</p>
                <p className="text-xs text-stone-400">
                  {child.classrooms?.academic_levels?.name} {child.classrooms?.section}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-stone-400">Attendance this month</p>
                  <p className="text-sm font-medium text-ink">
                    {child.totalDays > 0 ? `${child.presentDays}/${child.totalDays} days present` : "No records yet"}
                  </p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-stone-400">Tuition</p>
                  <p className="text-sm font-medium text-ink">
                    {child.tuitionBalance === null
                      ? "—"
                      : child.tuitionBalance <= 0
                      ? "Fully paid"
                      : `GHS ${child.tuitionBalance} remaining`}
                  </p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-stone-400">Canteen</p>
                  <p className="text-sm font-medium text-ink">
                    {child.canteenPaid === null ? "—" : child.canteenPaid ? "Paid" : "Due"}
                  </p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3">
                  <p className="text-xs text-stone-400">Transport</p>
                  <p className="text-sm font-medium text-ink">
                    {child.transportPaid === null ? "—" : child.transportPaid ? "Paid" : "Due"}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {childData.length === 0 && (
            <p className="text-sm text-stone-400">
              No children are linked to your account yet. Please contact the school office.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
