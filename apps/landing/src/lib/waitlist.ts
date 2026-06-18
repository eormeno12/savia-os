import { z } from "zod";

export const experienceValues = ["junior", "mid", "senior", "clevel"] as const;
export const monthlySpendValues = ["0", "1-20", "21-100", "100+"] as const;

export const experienceOptions = [
  { value: "junior", label: "Junior" },
  { value: "mid",    label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "clevel", label: "C-Level" },
] as const satisfies readonly { value: (typeof experienceValues)[number]; label: string }[];

export const monthlySpendOptions = [
  { value: "0",      label: "Aún no pago" },
  { value: "1-20",   label: "Hasta $20" },
  { value: "21-100", label: "$21 – $100" },
  { value: "100+",   label: "Más de $100" },
] as const satisfies readonly { value: (typeof monthlySpendValues)[number]; label: string }[];

export const AI_TOOL_OPTIONS = [
  "ChatGPT", "Claude", "Gemini", "Cursor",
  "Grok", "Codex", "Copilot", "NotebookLM",
] as const;

export const waitlistSchema = z.object({
  email: z.string().trim().email("Escribe un email válido."),
  role: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "Escribe tu rol."),
  ),
  experience: z.enum(experienceValues, {
    required_error: "Selecciona tu seniority.",
  }),
  aiTools: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, "Selecciona al menos una IA."),
  ),
  monthlySpend: z.enum(monthlySpendValues, {
    required_error: "Selecciona cuánto inviertes al mes.",
  }),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
