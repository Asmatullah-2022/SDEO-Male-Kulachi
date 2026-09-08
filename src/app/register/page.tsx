import type { Metadata } from "next";
import { RegisterClient } from "./RegisterClient";

export const metadata: Metadata = {
  title: "Create Headteacher Account | SDEO (Male) Kulachi",
  description: "Register a new Headteacher account for the SDEO (Male) Kulachi Daily Enrollment Monitoring System.",
};

export default function RegisterPage() {
  return <RegisterClient />;
}
