"use server";

import { headers } from "next/headers";
import {
  appendWaitlistEntry,
  hasWaitlistEmail,
  isGoogleSheetsConfigured,
} from "@/lib/google-sheets";
import { waitlistSchema, type WaitlistInput } from "@/lib/waitlist";

export type WaitlistActionState = {
  errors?: Partial<Record<keyof WaitlistInput, string[]>>;
  message: string;
  status: "idle" | "success" | "duplicate" | "error";
};

const localEmails = new Set<string>();

function extractUtm(referer: string) {
  if (!referer) return { campaign: "", medium: "", source: "" };

  try {
    const url = new URL(referer);
    return {
      campaign: url.searchParams.get("utm_campaign") ?? "",
      medium: url.searchParams.get("utm_medium") ?? "",
      source: url.searchParams.get("utm_source") ?? "",
    };
  } catch {
    return { campaign: "", medium: "", source: "" };
  }
}

export async function joinWaitlist(
  _prev: WaitlistActionState,
  formData: FormData,
): Promise<WaitlistActionState> {
  // Honeypot — silent success for bots
  if (String(formData.get("website") ?? "").trim()) {
    await new Promise((r) => setTimeout(r, 300));
    return { message: "Ya eres parte del grupo inicial de SAVIA.", status: "success" };
  }

  const parsed = waitlistSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    experience: formData.get("experience"),
    aiTools: formData.get("aiTools"),
    monthlySpend: formData.get("monthlySpend"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Completa los campos para unirte a los primeros usuarios.",
      status: "error",
    };
  }

  const input = { ...parsed.data, email: parsed.data.email.trim().toLowerCase() };
  const headersList = await headers();
  const referer = headersList.get("referer") ?? "";
  const utm = extractUtm(referer);
  const endpoint =
    process.env.WAITLIST_ENDPOINT ?? process.env.NEXT_PUBLIC_WAITLIST_ENDPOINT;

  const metadata = {
    language: headersList.get("accept-language")?.split(",")[0]?.trim() ?? "",
    referer,
    source: "landing-v3",
    userAgent: headersList.get("user-agent") ?? "",
    utmCampaign: utm.campaign,
    utmMedium: utm.medium,
    utmSource: utm.source,
  };

  if (isGoogleSheetsConfigured()) {
    try {
      if (await hasWaitlistEmail(input.email)) {
        return {
          message: "Ese email ya forma parte de los primeros usuarios.",
          status: "duplicate",
        };
      }

      await appendWaitlistEntry({ ...input, ...metadata });
    } catch (error) {
      console.error("[waitlist] Google Sheets write failed", error);
      return {
        message: "No pudimos guardar tu registro. Inténtalo de nuevo en un momento.",
        status: "error",
      };
    }

    return {
      message: "Ya eres parte del grupo inicial. Te avisaremos cuando abramos el siguiente cupo.",
      status: "success",
    };
  }

  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, ...metadata }),
      });

      if (!res.ok) {
        return {
          message: "No pudimos guardar tu registro. Inténtalo de nuevo en un momento.",
          status: "error",
        };
      }
    } catch {
      return {
        message: "No pudimos conectar con la waitlist. Inténtalo de nuevo.",
        status: "error",
      };
    }

    return {
      message: "Ya eres parte del grupo inicial. Te avisaremos cuando abramos el siguiente cupo.",
      status: "success",
    };
  }

  // Local in-memory fallback (development only)
  if (localEmails.has(input.email)) {
    return { message: "Ese email ya forma parte de los primeros usuarios.", status: "duplicate" };
  }

  localEmails.add(input.email);

  return {
    message: "Ya eres parte del grupo inicial. Te avisaremos cuando abramos el siguiente cupo.",
    status: "success",
  };
}
