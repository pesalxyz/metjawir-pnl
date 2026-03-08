import { z } from "zod";

export const generateSchema = z.object({
  input: z.string().trim().min(1, "Transaction signature or explorer URL is required."),
  theme: z.enum(["aurora", "midnight", "emerald"]).default("aurora").optional(),
  ratio: z.enum(["1:1", "16:9"]).default("1:1").optional(),
  watermark: z.boolean().optional(),
  customBackgroundUrl: z
    .string()
    .max(4000, "Background URL is too long")
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        if (value.startsWith("data:image/")) return true;
        try {
          const url = new URL(value);
          return ["https:"].includes(url.protocol);
        } catch {
          return false;
        }
      },
      { message: "Background must be an HTTPS URL or image data URL." }
    )
});
