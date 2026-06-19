"use client";

import { useActionState, useState } from "react";
import { Box, Button as ChakraButton, Field, Grid, Input, Stack, Text } from "@chakra-ui/react";
import { ArrowUpRight } from "lucide-react";
import { SaviaMark } from "@/components/design-system/savia-mark";
import { joinWaitlist, type WaitlistActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { experienceOptions as EXPERIENCE_CHIPS, AI_TOOL_OPTIONS, monthlySpendOptions as MONTHLY_SPEND_CHIPS, waitlistSchema } from "@/lib/waitlist";


const initialState: WaitlistActionState = { message: "", status: "idle" };


export function WaitlistForm() {
  const [state, formAction, pending] = useActionState(joinWaitlist, initialState);
  const [aiTools, setAiTools] = useState<Set<string>>(new Set());
  const [monthlySpend, setMonthlySpend] = useState("1-20");
  const [experience, setExperience] = useState("senior");
  const [submittedEmail, setSubmittedEmail] = useState("");

  // Controlled values para validación en tiempo real
  const [roleValue, setRoleValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);

  if (state.status === "success" || state.status === "duplicate") {
    return <SuccessCard email={submittedEmail} status={state.status} />;
  }

  function buildPayload() {
    return {
      email: emailValue,
      role: roleValue,
      experience,
      aiTools: [...aiTools].join(','),
      monthlySpend,
    };
  }

  // Validates against the Zod schema — only shows errors for touched/submitted fields
  function fieldError(field: string): string | undefined {
    if (!submitAttempted && !touched.has(field)) return undefined;
    const result = waitlistSchema.safeParse(buildPayload());
    if (result.success) return undefined;
    const issue = result.error.issues.find((i) => i.path[0] === field);
    return issue?.message ?? (state.errors as Record<string, string[]> | undefined)?.[field]?.[0];
  }

  function touch(field: string) {
    setTouched((prev) => new Set(prev).add(field));
  }

  function toggleAiTool(tool: string) {
    setAiTools((prev) => {
      const next = new Set(prev);
      if (next.has(tool)) next.delete(tool);
      else next.add(tool);
      return next;
    });
    touch("aiTools");
  }

  function handleSubmit(e: { preventDefault(): void }) {
    setSubmitAttempted(true);
    const result = waitlistSchema.safeParse(buildPayload());
    if (!result.success) {
      e.preventDefault();
      return;
    }
    setSubmittedEmail(emailValue.trim().toLowerCase());
  }

  return (
    <Box bg="bg" borderRadius="panel" p={{ base: "8", lg: "10" }} boxShadow="float">
      <Stack gap="1" mb="6">
        <Text fontSize="titleLg" fontWeight="600" color="fg" lineHeight="1.1">
          Únete a la comunidad
        </Text>
        <Text fontSize="sm" color="fg.muted" lineHeight="1.6">
          Sé de los primeros en entrar. Te avisamos cuando abramos.
        </Text>
      </Stack>

      <form action={formAction} onSubmit={handleSubmit} noValidate aria-label="Formulario de registro en la lista de espera">

        {/* Honeypot anti-bot */}
        <Box
          aria-hidden="true"
          position="absolute"
          left="-9999px"
          w="1px"
          h="1px"
          overflow="hidden"
        >
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" autoComplete="off" tabIndex={-1} />
        </Box>

        {/* Valores de chips → FormData */}
        <input type="hidden" name="aiTools" value={[...aiTools].join(",")} />
        <input type="hidden" name="monthlySpend" value={monthlySpend} />
        <input type="hidden" name="experience" value={experience} />

        <Stack gap="5">

          {/* Seniority */}
          <ChipField label="Seniority" error={fieldError("experience")}>
            <Grid templateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }} gap="2" role="radiogroup" aria-label="Seniority">
              {EXPERIENCE_CHIPS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={experience === value}
                  chipRole="radio"
                  onClick={() => setExperience(value)}
                />
              ))}
            </Grid>
          </ChipField>

          {/* Rol */}
          <FormField label="¿Cuál es tu rol?" htmlFor="role" error={fieldError("role")}>
            <Input
              id="role"
              name="role"
              type="text"
              placeholder="Ej. Head of Growth, CFO, Freelance Designer…"
              autoComplete="organization-title"
              bg="bg.inset"
              borderColor="border"
              color="fg"
              borderRadius="xl"
              h="11"
              fontSize="sm"
              _placeholder={{ color: "fg.subtle" }}
              _focus={{ borderColor: "fg", boxShadow: "none" }}
              _invalid={{ borderColor: "red.500" }}
              value={roleValue}
              onChange={(e) => setRoleValue(e.target.value)}
              onBlur={() => touch("role")}
            />
          </FormField>

          {/* IAs que usa (multi-select) */}
          <ChipField label="¿Qué IAs usas?" error={fieldError("aiTools")}>
            <Grid templateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }} gap="2" role="group" aria-label="¿Qué IAs usas?">
              {AI_TOOL_OPTIONS.map((tool) => (
                <Chip
                  key={tool}
                  label={tool}
                  selected={aiTools.has(tool)}
                  chipRole="checkbox"
                  onClick={() => toggleAiTool(tool)}
                />
              ))}
            </Grid>
          </ChipField>

          {/* Inversión mensual */}
          <ChipField
            label="¿Cuánto inviertes en IAs al mes?"
            error={fieldError("monthlySpend")}
          >
            <Grid templateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" }} gap="2" role="radiogroup" aria-label="¿Cuánto inviertes en IAs al mes?">
              {MONTHLY_SPEND_CHIPS.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={monthlySpend === value}
                  chipRole="radio"
                  onClick={() => setMonthlySpend(value)}
                />
              ))}
            </Grid>
          </ChipField>

          {/* Correo — al final como cierre */}
          <FormField
            label="Correo electrónico"
            htmlFor="email"
            error={fieldError("email")}
          >
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              required
              bg="bg.inset"
              borderColor="border"
              color="fg"
              borderRadius="xl"
              h="11"
              fontSize="sm"
              _placeholder={{ color: "fg.subtle" }}
              _focus={{ borderColor: "fg", boxShadow: "none" }}
              _invalid={{ borderColor: "red.500" }}
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              onBlur={() => touch("email")}
            />
          </FormField>

          {/* Error global del server action */}
          {state.status === "error" && (
            <Text role="status" fontSize="sm" color="fg.muted">
              {state.message}
            </Text>
          )}

          {/* Submit */}
          <Stack gap="2">
            <Button
              type="submit"
              colorPalette="lime"
              size="lg"
              w="full"
              loading={pending}
              loadingText="Uniéndome…"
            >
              Unirme a la comunidad
              <ArrowUpRight size={16} />
            </Button>
            <Text fontSize="xs" color="fg.muted" textAlign="center">
              Con profesionales que van en serio.
            </Text>
          </Stack>

        </Stack>
      </form>
    </Box>
  );
}

/* ── Sub-componentes ───────────────────────────────────────── */

function Chip({
  label,
  selected,
  chipRole = 'radio',
  onClick,
}: {
  label: string;
  selected: boolean;
  chipRole?: 'radio' | 'checkbox';
  onClick: () => void;
}) {
  return (
    <ChakraButton
      type="button"
      variant="plain"
      role={chipRole}
      aria-checked={selected}
      onClick={onClick}
      bg={selected ? "bg.inverse" : "bg.subtle"}
      color={selected ? "fg.inverse" : "fg.muted"}
      borderWidth="1px"
      borderStyle="solid"
      borderColor={selected ? "transparent" : "border"}
      borderRadius="10px"
      h="auto"
      minH="auto"
      w="full"
      px="3"
      py="2.5"
      fontSize="sm"
      fontWeight="600"
      lineHeight="1.3"
      whiteSpace="normal"
      textAlign="center"
      userSelect="none"
      transition="background 160ms ease, color 160ms ease, border-color 160ms ease"
      _hover={{ bg: selected ? "bg.inverse" : "bg.inset" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "signalLime",
        outlineOffset: "2px",
        boxShadow: "none",
      }}
    >
      {label}
    </ChakraButton>
  );
}

function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Field.Root invalid={Boolean(error)} id={htmlFor}>
      <Stack gap="2" w="full">
        <Field.Label
          fontSize="xs"
          fontWeight="700"
          letterSpacing="0.03em"
          color="fg"
          mb="0"
        >
          {label}
        </Field.Label>
        {children}
        <Field.ErrorText fontSize="xs" fontWeight="600" color="red.500">
          {error}
        </Field.ErrorText>
      </Stack>
    </Field.Root>
  );
}

function ChipField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Stack gap="2">
      <Text fontSize="xs" fontWeight="700" letterSpacing="0.03em" color="fg">
        {label}
      </Text>
      <Box
        borderWidth="1px"
        borderColor={error ? "red.500" : "transparent"}
        borderRadius="xl"
        p={error ? "2" : "0"}
        transition="border-color 160ms ease, padding 160ms ease"
      >
        {children}
      </Box>
      {error && (
        <Text fontSize="xs" fontWeight="600" color="red.500" role="alert">
          {error}
        </Text>
      )}
    </Stack>
  );
}

function SuccessCard({ email, status }: { email: string; status: "success" | "duplicate" }) {
  const isDuplicate = status === "duplicate";

  return (
    <Box bg="ink" borderRadius="panel" p={{ base: "8", lg: "10" }} boxShadow="float" overflow="hidden" position="relative">
      {/* Fondo decorativo */}
      <Box
        position="absolute"
        top="-40px"
        right="-40px"
        w="180px"
        h="180px"
        borderRadius="full"
        bg="signalLime"
        opacity={0.06}
        pointerEvents="none"
      />

      <Stack alignItems="center" gap="6" py="16" textAlign="center" position="relative">

        {/* Logo mark */}
        <Box>
          <SaviaMark size={32} color="#E7FF18" />
        </Box>

        {/* Eyebrow */}
        <Text
          fontSize="xs"
          fontWeight="700"
          letterSpacing="0.12em"
          textTransform="uppercase"
          color="signalLime"
        >
          {isDuplicate ? "Ya estás registrado" : "Ya estás dentro"}
        </Text>

        {/* Headline */}
        <Text
          fontSize={{ base: "displayLg", lg: "displayXl" }}
          fontWeight="300"
          color="fg.inverse"
          lineHeight="0.95"
          textWrap="balance"
        >
          {isDuplicate ? (
            <>
              Savia ya{" "}
              <Text as="span" fontWeight="700" color="signalLime">
                te conoce.
              </Text>
            </>
          ) : (
            <>
              Savia ya{" "}
              <Text as="span" fontWeight="700" color="signalLime">
                te recuerda.
              </Text>
            </>
          )}
        </Text>

        {/* Divider */}
        <Box w="8" h="px" bg="fg.inverse" opacity={0.15} />

        {/* Subtext */}
        <Text fontSize="sm" color="fg.inverse" opacity={0.5} lineHeight="1.8" maxW="18rem">
          {isDuplicate ? (
            <>
              <Text as="span" color="fg.inverse" fontWeight="600" opacity={1}>
                {email}
              </Text>{" "}
              ya está en la lista. Te avisaremos cuando abramos acceso.
            </>
          ) : (
            <>
              Te escribiremos a{" "}
              <Text as="span" color="fg.inverse" fontWeight="600" opacity={1}>
                {email}
              </Text>{" "}
              cuando abramos acceso.
            </>
          )}
        </Text>

      </Stack>
    </Box>
  );
}
