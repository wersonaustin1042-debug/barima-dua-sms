"use client";

import { useFormStatus } from "react-dom";

// Wraps a submit button so it disables itself the instant the form's
// action starts running, instead of only after the page reloads. Fixes
// the "double-clicked and it charged everyone twice" class of bug for any
// form that uses this instead of a plain <button type="submit">.
export default function SubmitButton({ children, pendingLabel, className, disabled }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={className}>
      {pending ? pendingLabel || "Working…" : children}
    </button>
  );
}
