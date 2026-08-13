import { z } from "zod";

export const onboardingSchema = z.object({
  companyName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  country: z.string().optional(),
  currency: z.string().optional(),
  packageCode: z.string().min(1),
  extraBundleCodes: z.array(z.string()).optional().default([]),
  billingCycleCode: z.string().min(1),
  storeName: z.string().min(1),
  storeLocation: z.string().optional(),
  gmName: z.string().min(2),
  gmEmail: z.string().email(),
  gmPhone: z.string().optional(),
  repConfirmedClientAgreed: z.literal(true, {
    errorMap: () => ({
      message:
        "You must confirm the client has agreed to the Terms before creating their account",
    }),
  }),
});