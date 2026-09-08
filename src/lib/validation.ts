import { z } from "zod";

const nonNegativeInt = z
  .coerce.number({ message: "Must be a number" })
  .int("Whole numbers only")
  .min(0, "Cannot be negative")
  .max(100000, "Value too large");

export const enrollmentSchema = z.object({
  dropout: nonNegativeInt,
  public_admission: nonNegativeInt,
  private_admission: nonNegativeInt,
  fresh_admission: nonNegativeInt,
  remarks: z.string().trim().max(500, "Remarks must be 500 characters or fewer").optional().or(z.literal("")),
});

export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email or mobile number is required"),
  password: z.string().min(1, "Password is required"),
});

export const schoolSchema = z.object({
  school_name: z.string().trim().min(2, "School name is required"),
  emis_code: z.string().trim().min(1, "EMIS code is required"),
  district: z.string().trim().min(1, "District is required"),
  tehsil: z.string().trim().min(1, "Tehsil is required"),
  circle: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});

export const publicEnrollmentSubmitSchema = z.object({
  emis_code: z.string().trim().min(1, "Select a school first"),
  dropout: nonNegativeInt,
  public_admission: nonNegativeInt,
  private_admission: nonNegativeInt,
  fresh_admission: nonNegativeInt,
});

export type PublicEnrollmentSubmitInput = z.infer<typeof publicEnrollmentSubmitSchema>;

export const headteacherSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  mobile_number: z.string().trim().min(1, "Mobile number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  school_id: z.string().uuid("Select a school"),
});

const pakistaniMobileNumber = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    return /^03\d{9}$/.test(digits) || /^923\d{9}$/.test(digits);
  }, "Enter a valid Pakistani mobile number (e.g. 03001234567)");

/**
 * Public self-registration form (see src/app/register). Role is
 * deliberately not a field here at all — every self-registered account is
 * a headteacher; that is enforced again, independently, by the
 * handle_new_user trigger which never reads role from signup metadata
 * (see supabase/schema.sql).
 */
export const registrationSchema = z
  .object({
    full_name: z.string().trim().min(2, "Full name is required"),
    email: z.string().trim().email("Enter a valid email address"),
    mobile_number: pakistaniMobileNumber,
    school_id: z.string().uuid("Select your school"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

/**
 * Full Name + Mobile Number only — the fields a headteacher may edit on
 * their own profile, and the fields an admin may edit on a headteacher's
 * profile via User Management. Never includes email, role, or school_id:
 * those are either read-only in the UI or have their own dedicated flow
 * (school reassignment), and are blocked at the database level regardless
 * (see the profiles_restrict_self_update trigger in schema.sql).
 */
export const profileEditSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  mobile_number: z
    .string()
    .trim()
    .min(1, "Mobile number is required")
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return /^03\d{9}$/.test(digits) || /^923\d{9}$/.test(digits);
    }, "Enter a valid Pakistani mobile number (e.g. 03001234567)"),
});

export type ProfileEditInput = z.infer<typeof profileEditSchema>;

export const changePasswordSchema = z
  .object({
    new_password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
