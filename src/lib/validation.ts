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
