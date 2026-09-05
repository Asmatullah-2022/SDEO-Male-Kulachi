import type { DailyEnrollment, School } from "./types";
import { formatDisplayDate } from "./date";

/**
 * The official SDEO (Male) Kulachi WhatsApp number, kept out of source code.
 * Configure NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER in .env (E.164 format, no
 * leading "+", e.g. 923001234567).
 */
export const OFFICIAL_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_OFFICIAL_WHATSAPP_NUMBER ?? "";

export function buildWhatsAppMessage(
  report: Pick<
    DailyEnrollment,
    "report_date" | "dropout" | "public_admission" | "private_admission" | "fresh_admission" | "total_enrollment"
  >,
  school: Pick<School, "school_name" | "emis_code">
): string {
  return [
    "📊 *DAILY ENROLLMENT DATA*",
    "━━━━━━━━━━━━━━━━",
    `📅 Date: ${formatDisplayDate(report.report_date)}`,
    `🏫 School Name: ${school.school_name}`,
    `🔢 EMIS Code: ${school.emis_code}`,
    "",
    `Drop Out: ${report.dropout}`,
    `Public: ${report.public_admission}`,
    `Private: ${report.private_admission}`,
    `Fresh Admission: ${report.fresh_admission}`,
    `📚 Total Enrollment: ${report.total_enrollment}`,
    "━━━━━━━━━━━━━━━━",
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
