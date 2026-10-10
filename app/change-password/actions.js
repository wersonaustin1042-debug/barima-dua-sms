"use server";
import { redirect } from "next/navigation";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_LIKE = ["admin", "director", "headmaster", "assistant_headmaster"];

// A throwaway client that never stores a session, used only to test whether
// a password is accepted for this email.
function passwordWorks(email, password) {
  const anon = createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return anon.auth.signInWithPassword({ email, password }).then(({ error }) => !error);
}

// Lets a signed-in person set their own password. Used both for the forced
// change at first login (after an admin created or reset the account) and
// for changing it any time later. Nobody else — admin included — ever sees
// the new password.
export async function changeOwnPassword(prevState, formData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  // Recomputed here from the server's copy of the user, never from the form.
  const forced = user.app_metadata?.must_change_password === true;

  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  const confirm = String(formData.get("confirmPassword") || "");

  if (next.length < 8) return { error: "Your new password must be at least 8 characters." };
  if (next !== confirm) return { error: "The two new passwords don't match." };

  // Outside the forced first-login change, ask for the current password so
  // someone using a left-open session can't quietly take over the account.
  if (!forced) {
    if (!current) return { error: "Enter your current password." };
    if (!(await passwordWorks(user.email, current))) return { error: "Your current password is wrong." };
  }

  // Refuse to keep the old/temporary password: if it already works, it's the same one.
  if (await passwordWorks(user.email, next)) {
    return { error: "Choose a different password from the one you signed in with." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: next,
    app_metadata: { must_change_password: false },
  });
  if (error) return { error: error.message };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  let destination = "/dashboard";
  if (profile?.role === "parent") destination = "/parent";
  else if (profile?.role === "accountant") destination = "/fees";
  else if (profile?.role === "teacher") destination = "/attendance";
  else if (ADMIN_LIKE.includes(profile?.role)) destination = "/dashboard";

  redirect(destination);
}
