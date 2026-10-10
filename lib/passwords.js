import { randomInt } from "crypto";

// Server-only. Makes a random temporary password for a new or reset account.
// Skips look-alike characters (0/O, 1/l/I) so it's easy to read out or type
// from a WhatsApp message. Always has at least one letter and one digit.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL = LETTERS + DIGITS;

export function generateTempPassword(length = 10) {
  for (;;) {
    let out = "";
    for (let i = 0; i < length; i++) out += ALL[randomInt(ALL.length)];
    if (/[A-Za-z]/.test(out) && /[0-9]/.test(out)) return out;
  }
}

// Roles allowed to manage logins (same as is_admin_like() in the database).
export const ADMIN_LIKE_ROLES = ["admin", "director", "headmaster", "assistant_headmaster"];
// Only these may create or reset the most powerful accounts.
export const TOP_ROLES = ["admin", "director"];
