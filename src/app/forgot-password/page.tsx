import type { Metadata } from "next";
import { ForgotPasswordClient } from "./ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Reset Your Password | SDEO (Male) Kulachi",
  description: "Request a password reset link for the SDEO (Male) Kulachi Daily Enrollment Monitoring System.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
