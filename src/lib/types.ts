export type UserRole = "headteacher" | "admin";
export type SchoolStatus = "active" | "inactive";

export interface School {
  id: string;
  school_name: string;
  emis_code: string;
  district: string;
  tehsil: string;
  circle: string | null;
  status: SchoolStatus;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  mobile_number: string | null;
  designation: string;
  school_id: string | null;
  role: UserRole;
  created_at: string;
}

/**
 * A profile enriched with its auth email address. Email lives on
 * `auth.users`, not `profiles`, so this is only available where it has
 * been joined in server-side code with the service-role client.
 */
export interface HeadteacherUser extends Profile {
  email: string | null;
}

export interface DailyEnrollment {
  id: string;
  school_id: string;
  user_id: string;
  report_date: string;
  dropout: number;
  public_admission: number;
  private_admission: number;
  fresh_admission: number;
  total_enrollment: number;
  submitted_at: string;
  updated_at: string;
}

export interface EnrollmentFormValues {
  dropout: number;
  public_admission: number;
  private_admission: number;
  fresh_admission: number;
  total_enrollment: number;
}
