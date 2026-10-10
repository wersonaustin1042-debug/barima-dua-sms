import { createClient } from "@/lib/supabase/server";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const forced = user?.app_metadata?.must_change_password === true;
  return <ChangePasswordForm forced={forced} />;
}
