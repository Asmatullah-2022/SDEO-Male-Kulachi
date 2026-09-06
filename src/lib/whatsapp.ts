import type { DailyEnrollment, School } from "./types";
import { formatDisplayDate } from "./date";

/**
 * The official SDEO (Male) Kulachi WhatsApp number, kept out of source code.
 * Configure NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER in .env (E.164 format, no
 * leading "+", e.g. 923001234567). Only used where a specific individual is
 * being messaged (e.g. the admin's pending-schools reminder) — the daily
 * report itself goes to the "SDEO (M) Kulachi" WhatsApp GROUP, which has no
 * phone number to target; see buildGroupShareLink().
 */
export const OFFICIAL_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER ?? "";

export function buildWhatsAppMessage(
  report: Pick<
    DailyEnrollment,
    "report_date" | "dropout" | "public_admission" | "private_admission" | "fresh_admission" | "total_enrollment"
  >,
  school: Pick<School, "school_name" | "emis_code">,
  headteacherName: string
): string {
  return [
    "📊 DAILY ENROLLMENT REPORT",
    "",
    `📅 Date: ${formatDisplayDate(report.report_date)}`,
    "",
    `🏫 School: ${school.school_name}`,
    `🔢 EMIS Code: ${school.emis_code}`,
    "",
    `📉 Drop Out: ${report.dropout}`,
    `🏛️ Public Admission: ${report.public_admission}`,
    `🏢 Private Admission: ${report.private_admission}`,
    `🆕 Fresh Admission: ${report.fresh_admission}`,
    "",
    `📚 Total Enrollment: ${report.total_enrollment}`,
    "",
    "━━━━━━━━━━━━━━━━",
    "",
    `Submitted by: ${headteacherName}`,
    "",
    "SDEO (Male) Kulachi",
    "Daily Enrollment Monitoring System",
  ].join("\n");
}

export function buildWhatsAppDeepLink(message: string, number = OFFICIAL_WHATSAPP_NUMBER): string {
  const encoded = encodeURIComponent(message);
  return number
    ? `https://wa.me/${number}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

/**
 * Opens WhatsApp with the message pre-filled but no target chat selected,
 * so the Headteacher picks the "SDEO (M) Kulachi" group themselves and
 * presses Send. WhatsApp groups have no phone number to link to directly —
 * a wa.me/<number> link can only ever open a 1:1 chat — so this
 * intentionally never passes a number, regardless of
 * NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER.
 */
export function buildGroupShareLink(message: string): string {
  return buildWhatsAppDeepLink(message, "");
}

/**
 * The reminder message sent to a headteacher whose school hasn't submitted
 * today's report yet. Text and line breaks are fixed by SDEO office policy
 * — do not reword.
 */
export function buildAbsenceReminderMessage(): string {
  return (
    "محترم ہیڈ ٹیچر صاحب،\n" +
    "آپ کے سکول کی آج کی Daily Enrollment Report ابھی تک موصول نہیں ہوئی۔\n" +
    "براہ کرم فوری طور پر SDEO Kulachi Daily Enrollment Monitoring System میں رپورٹ جمع کروائیں۔\n" +
    "\n" +
    "شکریہ\n" +
    "SDEO (Male) Kulachi"
  );
}

/**
 * Best-effort normalization of a Pakistani mobile number (as typically
 * entered by hand — "0300-1234567", "03001234567", "+923001234567", etc.)
 * into the digits-only international format wa.me requires. Returns null
 * if the input doesn't look like a usable number, so callers can hide the
 * reminder action rather than link to a broken chat.
 */
export function toWhatsAppNumber(mobile: string | null | undefined): string | null {
  if (!mobile) return null;
  const digits = mobile.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("92") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.length === 10) return `92${digits}`;
  return digits.length >= 10 ? digits : null;
}
