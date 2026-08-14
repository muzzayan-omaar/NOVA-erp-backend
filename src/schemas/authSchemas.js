import { z } from "zod";

export const loginSchema = z.object({
  businessCode: z.string().min(1, "Business code is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  location: z.string().optional(),
  name: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  country: z.string().optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({
      message: "You must accept the Terms of Service and Privacy Policy",
    }),
  }),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const platformLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
