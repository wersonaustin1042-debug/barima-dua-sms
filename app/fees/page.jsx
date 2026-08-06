import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import {
  ensureFeeSetup,
  recordInstallment,
  changeFrequency,
  recordRecurringPayment,
} from "./actions";
import AutoSubmitSelect from "@/components/AutoSubmitSelect";

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

function periodLabel(frequency) {
  if (frequency === "daily") return "today";
  if (frequency === "weekly") return "this week";
  return "this month";
}

export default async function FeesPage({ searchParams }) {
  const supabase = createClient();
  const selectedClassroomId = searchParams?.classroomId;
  const selectedStudentId = searchParams?.studentId;

  const { data: classroomsRaw } = await supabase
    .from("classrooms")
    .select("id, section, academic_levels(name, sort_order)");
  const classrooms = (classroomsRaw || []).sort(
    (a, b) =>
      a.academic_levels.sort_order - b.academic_levels.sort_order ||
      a.section.localeCompare(b.section)
  );

  let classStudents = [];
  let statusByStudent = {};

  if (selectedClassroomId) {
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("classroom_id", selectedClassroomId)
      .eq("status", "active")
      .order("full_name");
    classStudents = studentsData || [];

    for (const s of classStudents) {
      await ensureFeeSetup(s.id);

      const { data: plan } = await supabase
        .from("tuition_plans")
        .select("total_amount, amount_paid")
        .eq("student_id", s.id)
        .single();

      const { data: fees } = await supabase
        .from("recurring_fees")
        .select("id, fee_type, frequency")
        .eq("student_id", s.id);

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

      statusByStudent[s.id] = {
        tuitionBalance: plan ? Number(plan.total_amount) - Number(plan.amount_paid) : 0,
        canteenPaid,
        transportPaid,
      };
    }
  }

  // Detail view for the selected student
  let plan = null;
  let recurringFees = [];
  let paidPeriodsByFee = {};
  let selectedStudentInfo = null;

  if (selectedStudentId) {
    selectedStudentInfo = classStudents.find((s) => s.id === selectedStudentId);

    const { data: planData } = await supabase
      .from("tuition_plans")
      .select("total_amount, amount_paid")
      .eq("student_id", selectedStudentId)
      .single();
    plan = planData;

    const { data: feesData } = await supabase
      .from("recurring_fees")
      .select("id, fee_type, frequency, amount")
      .eq("student_id", selectedStudentId)
      .order("fee_type");
    recurringFees = feesData || [];

    for (const fee of recurringFees) {
      const periodKey = getPeriodKey(fee.frequency);
      const { data: payment } = await supabase
        .from("recurring_fee_payments")
        .select("id")
        .eq("recurring_fee_id", fee.id)
        .eq("period_key", periodKey)
        .maybeSingle();
      paidPeriodsByFee[fee.id] = !!payment;
    }
  }

  const balance = plan ? Number(plan.total_amount) - Number(plan.amount_paid) : 0;
  const pct = plan ? Math.round((Number(plan.amount_paid) / Number(plan.total_amount)) * 100) : 0;

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Fees & payments</h1>
        <p className="text-stone-500 text-sm mb-6">Pick a class to see everyone's fee status at a glance.</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {classrooms.map((c) => (
            <Link
              key={c.id}
              href={`/fees?classroomId=${c.id}`}
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
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Student</th>
                  <th className="text-center px-3 py-2 font-medium">Tuition</th>
                  <th className="text-center px-3 py-2 font-medium">Canteen</th>
                  <th className="text-center px-3 py-2 font-medium">Transport</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((s) => {
                  const st = statusByStudent[s.id] || {};
                  return (
                    <tr
                      key={s.id}
                      className={`border-t border-stone-100 ${
                        s.id === selectedStudentId ? "bg-stone-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2">
                        <Link
                          href={`/fees?classroomId=${selectedClassroomId}&studentId=${s.id}`}
                          className="text-ink font-medium hover:text-pine"
                        >
                          {s.full_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            st.tuitionBalance <= 0
                              ? "bg-pine/10 text-pine border-pine/30"
                              : "bg-slateblue/10 text-slateblue border-slateblue/30"
                          }`}
                        >
                          {st.tuitionBalance <= 0 ? "Paid" : `GHS ${st.tuitionBalance}`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            st.canteenPaid
                              ? "bg-pine/10 text-pine border-pine/30"
                              : "bg-clay/10 text-clay border-clay/30"
                          }`}
                        >
                          {st.canteenPaid ? "Paid" : "Due"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            st.transportPaid
                              ? "bg-pine/10 text-pine border-pine/30"
                              : "bg-clay/10 text-clay border-clay/30"
                          }`}
                        >
                          {st.transportPaid ? "Paid" : "Due"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {classStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-stone-400">
                      No students in this class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {selectedStudentInfo && plan && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-ink">
              Managing: <span className="text-pine">{selectedStudentInfo.full_name}</span>
            </p>

            {/* Tuition */}
            <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Tuition</p>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    balance <= 0
                      ? "bg-pine/10 text-pine border-pine/30"
                      : "bg-slateblue/10 text-slateblue border-slateblue/30"
                  }`}
                >
                  {balance <= 0 ? "Fully paid" : `GHS ${balance} remaining`}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-pine rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-stone-400">
                GHS {plan.amount_paid} of GHS {plan.total_amount} paid ({pct}%)
              </p>
              {balance > 0 && (
                <form action={recordInstallment} className="flex gap-2 pt-1">
                  <input type="hidden" name="studentId" value={selectedStudentId} />
                  <input
                    type="number"
                    name="amount"
                    min="1"
                    max={balance}
                    step="0.01"
                    required
                    placeholder={`Amount (up to GHS ${balance})`}
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="text-xs font-medium bg-pine text-paper px-3 py-2 rounded-lg hover:bg-pine/90 whitespace-nowrap"
                  >
                    Record installment
                  </button>
                </form>
              )}
            </div>

            {/* Canteen + Transport */}
            {recurringFees.map((fee) => {
              const isPaid = paidPeriodsByFee[fee.id];
              return (
                <div key={fee.id} className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink capitalize">{fee.fee_type}</p>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${
                        isPaid
                          ? "bg-pine/10 text-pine border-pine/30"
                          : "bg-clay/10 text-clay border-clay/30"
                      }`}
                    >
                      {isPaid ? "Paid" : "Due"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400">GHS {fee.amount} · billed</span>
                    <form action={changeFrequency}>
                      <input type="hidden" name="feeId" value={fee.id} />
                      <AutoSubmitSelect
                        name="frequency"
                        defaultValue={fee.frequency}
                        className="text-xs rounded-lg border border-stone-300 px-2 py-1"
                        options={[
                          { value: "daily", label: "Daily" },
                          { value: "weekly", label: "Weekly" },
                          { value: "monthly", label: "Monthly" },
                        ]}
                      />
                    </form>
                  </div>
                  <p className="text-xs text-stone-400">
                    {isPaid
                      ? `Covered for ${periodLabel(fee.frequency)}`
                      : `Not yet paid for ${periodLabel(fee.frequency)}`}
                  </p>
                  {!isPaid && (
                    <form action={recordRecurringPayment}>
                      <input type="hidden" name="feeId" value={fee.id} />
                      <input type="hidden" name="frequency" value={fee.frequency} />
                      <button
                        type="submit"
                        className="text-xs font-medium bg-pine text-paper px-3 py-1.5 rounded-lg hover:bg-pine/90"
                      >
                        Record payment for {periodLabel(fee.frequency)}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
