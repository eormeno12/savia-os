"use client";

import { useState } from "react";
import { Box, Button, Input, Text, VStack } from "@chakra-ui/react";
import { api, ApiError } from "@/lib/api";

export function OtpForm() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.requestOtp(email);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.verifyOtp(email, code);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Código incorrecto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      bg="bg"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="card"
      p={{ base: "8", md: "10" }}
      w="full"
      maxW="22rem"
    >
      {step === "email" ? (
        <VStack as="form" gap="5" onSubmit={handleEmailSubmit}>
          <Box w="full">
            <Text textStyle="titleLg" fontWeight="600" color="fg" mb="1">
              Accede a Savia
            </Text>
            <Text color="fg.muted" fontSize="sm">
              Te enviamos un código de 6 dígitos a tu email.
            </Text>
          </Box>
          <Input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            size="lg"
          />
          {error && <Text color="red.500" fontSize="sm">{error}</Text>}
          <Button
            type="submit"
            colorPalette="lime"
            variant="solid"
            w="full"
            loading={loading}
            loadingText="Enviando…"
          >
            Continuar
          </Button>
        </VStack>
      ) : (
        <VStack as="form" gap="5" onSubmit={handleCodeSubmit}>
          <Box w="full">
            <Text textStyle="titleLg" fontWeight="600" color="fg" mb="1">
              Ingresa el código
            </Text>
            <Text color="fg.muted" fontSize="sm">
              Lo enviamos a <strong>{email}</strong>.
            </Text>
          </Box>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
            size="lg"
            letterSpacing="0.35em"
            textAlign="center"
            fontSize="xl"
          />
          {error && <Text color="red.500" fontSize="sm">{error}</Text>}
          <Button
            type="submit"
            colorPalette="lime"
            variant="solid"
            w="full"
            loading={loading}
            loadingText="Verificando…"
          >
            Entrar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            color="fg.muted"
            onClick={() => { setStep("email"); setCode(""); setError(""); }}
          >
            Cambiar email
          </Button>
        </VStack>
      )}
    </Box>
  );
}
