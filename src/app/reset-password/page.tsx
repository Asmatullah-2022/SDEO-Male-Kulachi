import type { Metadata } from "next";
import { ResetPasswordClient } from "./ResetPasswordClient";

export const metadata: Metadata = {
  title: "Create New Password | SDEO (Male) Kulachi",
  description: "Set a new password for the SDEO (Male) Kulachi Daily Enrollment Monitoring System.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
