"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, chakra, Input, Stack, Text } from "@chakra-ui/react";
import { Caption, Eyebrow, Field, OtpInput, notify } from "@savia-os/ui";
import { api, ApiError } from "@/lib/api";

const RESEND_COOLDOWN = 45;

/**
 * A1/A2 — passwordless login form (the right pane). Email → 6-digit OTP, with a
 * resend cooldown. Preserves the existing requestOtp/verifyOtp wiring; respects
 * a `?next=` redirect (used by the invite flow).
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/memoria";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function sendOtp() {
    setError("");
    setLoading(true);
    try {
      await api.requestOtp(email);
      setStep("code");
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(value: string) {
    setError("");
    setLoading(true);
    try {
      await api.verifyOtp(email, value);
      notify.success("Bienvenido de vuelta");
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código incorrecto.");
      setCode([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box w="full" maxW="400px">
      <Eyebrow>Paso 1 de 2 · Entrar</Eyebrow>

      {step === "email" ? (
        <Stack
          as="form"
          gap="0"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            void sendOtp();
          }}
        >
          <Text fontWeight="300" fontSize="displayMd" lineHeight="1.02" color="fg" mt="3.5">
            Entra a tu memoria.
          </Text>
          <Text fontSize="16px" lineHeight="1.6" color="fg.muted" mt="3.5" maxW="38ch">
            Te enviamos un código de un solo uso. Sin contraseñas que recordar.
          </Text>
          <Box mt="8">
            <Field label="Tu email" error={error || undefined}>
              <Input
                type="email"
                placeholder="nombre@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                size="lg"
              />
            </Field>
          </Box>
          <Button type="submit" colorPalette="ink" size="lg" w="full" mt="5" loading={loading} loadingText="Enviando…">
            Enviarme un código
          </Button>
          <Caption mt="4.5">Solo lo usamos para enviarte el código. Nada más.</Caption>
        </Stack>
      ) : (
        <Stack gap="0">
          <Text fontWeight="300" fontSize="displayMd" lineHeight="1.02" color="fg" mt="3.5">
            Revisa tu email.
          </Text>
          <Text fontSize="16px" lineHeight="1.6" color="fg.muted" mt="3.5" maxW="40ch">
            Enviamos un código de 6 dígitos a{" "}
            <Box as="span" color="fg" fontWeight="600">
              {email}
            </Box>
            .{" "}
            <Box
              as="button"
              color="fg"
              textDecoration="underline"
              onClick={() => {
                setStep("email");
                setCode([]);
                setError("");
              }}
            >
              Cambiar
            </Box>
          </Text>

          <Box mt="8">
            <OtpInput
              value={code}
              onValueChange={(e) => setCode(e.value)}
              onValueComplete={(e) => verify(e.valueAsString)}
              disabled={loading}
              size="lg"
              autoFocus
            />
          </Box>
          {error ? (
            <Text color="danger.fg" fontSize="14px" mt="3">
              {error}
            </Text>
          ) : null}

          <Button
            colorPalette="ink"
            size="lg"
            w="full"
            mt="6"
            loading={loading}
            loadingText="Verificando…"
            disabled={code.join("").length !== 6}
            onClick={() => verify(code.join(""))}
          >
            Entrar
          </Button>

          <Text fontSize="14px" color="fg.muted" mt="5">
            ¿No llegó?{" "}
            <chakra.button
              type="button"
              color={cooldown > 0 ? "fg.muted" : "fg"}
              fontWeight="600"
              disabled={cooldown > 0 || loading}
              onClick={() => void sendOtp()}
            >
              {cooldown > 0 ? `Reenviar en 0:${String(cooldown).padStart(2, "0")}` : "Reenviar código"}
            </chakra.button>
          </Text>
        </Stack>
      )}
    </Box>
  );
}
