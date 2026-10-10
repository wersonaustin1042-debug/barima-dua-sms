"use client";

import { useFormState } from "react-dom";
import { resetUserPassword } from "./actions";

const initialState = { error: null, success: null };

export default function ResetPasswordButton({ userId }) {
  const [state, formAction] = useFormState(resetUserPassword, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Give this person a new temporary password? Their current password will stop working.")) {
          e.preventDefault();
        }
      }}
      className="space-y-1"
    >
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-600 px-2 py-1 rounded-full">
        Reset password
      </button>
      {state?.error && <p className="text-[11px] text-clay">{state.error}</p>}
      {state?.tempPassword && (
        <p className="text-[11px] text-stone-500">
          {state.success} <span className="font-mono font-semibold text-ink select-all">{state.tempPassword}</span>
          <br />
          Shown only now. They must choose their own at next sign-in.
        </p>
      )}
    </form>
  );
}
