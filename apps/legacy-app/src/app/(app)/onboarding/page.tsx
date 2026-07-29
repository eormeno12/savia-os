"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { ArrowLeft, ArrowRight, Check, Copy, Plus, Sparkles, Upload } from "lucide-react";
import { CopyBlock, notify } from "@savia-os/ui";
import { api, ApiError } from "@/lib/api";

type Step = "welcome" | "import" | "rescue";
const STEPS = ["Bienvenida", "Poblar", "Conectar", "Listo"];

/**
 * O1–O3 — Onboarding: welcome (choose how to start), then import a ChatGPT
 * export or rescue memory via a prompt. "Empezar vacío" jumps straight to the
 * map; connecting an IA happens in Conexiones.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const stepIndex = step === "welcome" ? 0 : 1;

  return (
    <Stack gap="8" maxW="980px" mx="auto">
      <HStack gap="2.5" justify="center">
        {STEPS.map((label, i) => {
          const done = i < stepIndex;
          const here = i === stepIndex;
          return (
            <HStack key={label} gap="2.5">
              <HStack gap="2">
                <Box
                  w="2.5"
                  h="2.5"
                  rounded="full"
                  bg={done || here ? "ink.solid" : "transparent"}
                  borderWidth={done || here ? "0" : "1.5px"}
                  borderColor="border"
                />
                <Text fontSize="13px" fontWeight={here ? "600" : "500"} color={here || done ? "fg" : "fg.muted"}>
                  {label}
                </Text>
              </HStack>
              {i < STEPS.length - 1 ? <Box w="7" h="1px" bg="border" /> : null}
            </HStack>
          );
        })}
      </HStack>

      {step === "welcome" ? (
        <WelcomeStep
          onImport={() => setStep("import")}
          onRescue={() => setStep("rescue")}
          onSkip={() => router.push("/memoria")}
        />
      ) : step === "import" ? (
        <ImportStep onBack={() => setStep("welcome")} onDone={() => router.push("/memoria")} />
      ) : (
        <RescueStep onBack={() => setStep("welcome")} onDone={() => router.push("/memoria")} />
      )}
    </Stack>
  );
}

function WelcomeStep({
  onImport,
  onRescue,
  onSkip,
}: {
  onImport: () => void;
  onRescue: () => void;
  onSkip: () => void;
}) {
  return (
    <Stack gap="0">
      <Text fontWeight="300" fontSize="displayLg" lineHeight="1" color="fg">
        Hola.
      </Text>
      <Text fontSize="18px" color="fg.muted" mt="4" maxW="52ch" lineHeight="1.6">
        Vamos a darle vida a tu memoria. Elige cómo arrancar — luego Savia la organiza sola.
      </Text>

      <HStack gap="4.5" mt="9" align="stretch" flexDirection={{ base: "column", md: "row" }}>
        <Stack flex="1" bg="bg.inverse" color="fg.inverse" rounded="3xl" p="7" position="relative" overflow="hidden" gap="0">
          <Box position="absolute" w="220px" h="220px" rounded="full" bg="lime.solid" filter="blur(90px)" opacity="0.12" top="-90px" insetEnd="-60px" />
          <Box position="relative" as="span" alignSelf="flex-start" textStyle="label" color="ink.solid" bg="lime.solid" px="2.5" py="1.5" rounded="full">
            Recomendado
          </Box>
          <Box position="relative" color="lime.solid" mt="5.5">
            <Upload size={30} strokeWidth={1.6} />
          </Box>
          <Text position="relative" fontSize="20px" fontWeight="600" mt="4.5">
            Importar conversaciones
          </Text>
          <Text position="relative" fontSize="14px" color="fg.inverse" opacity="0.72" mt="2.5" lineHeight="1.55">
            Sube tus exports de ChatGPT, Claude o Gemini y extraemos tus recuerdos.
          </Text>
          <Button position="relative" colorPalette="lime" mt="6" onClick={onImport}>
            Importar
          </Button>
        </Stack>

        <OnbCard
          icon={<Copy size={30} strokeWidth={1.6} />}
          title="Rescatar con un prompt"
          body="Copia un prompt, pégalo en tu IA y trae la respuesta aquí."
          action={
            <Button variant="outline" onClick={onRescue}>
              Rescatar
            </Button>
          }
        />

        <OnbCard
          icon={<Plus size={30} strokeWidth={1.6} />}
          title="Empezar vacío"
          body="Salta este paso. Tu memoria se construye sola cuando conectes tus IAs."
          action={
            <Button variant="ghost" onClick={onSkip}>
              Saltar por ahora <ArrowRight size={15} />
            </Button>
          }
        />
      </HStack>
    </Stack>
  );
}

function OnbCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <Stack flex="1" bg="bg.panel" borderWidth="1px" borderColor="border" rounded="3xl" p="7" gap="0">
      <Box color="fg">{icon}</Box>
      <Text fontSize="20px" fontWeight="600" color="fg" mt="4.5">
        {title}
      </Text>
      <Text fontSize="14px" color="fg.muted" mt="2.5" lineHeight="1.55" flex="1">
        {body}
      </Text>
      <Box mt="6">{action}</Box>
    </Stack>
  );
}

function ImportStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (content.trim().length < 20) return notify.error("Pega el contenido de tu export.");
    setBusy(true);
    try {
      const { queued } = await api.onboarding.importChatGpt(content);
      notify.success("Importación en marcha", `${queued} conversaciones en cola.`);
      onDone();
    } catch (err) {
      notify.error(err instanceof ApiError ? err.message : "No pudimos importar.");
      setBusy(false);
    }
  }

  return (
    <Stack gap="5" maxW="680px" mx="auto" w="full">
      <Box>
        <Text fontWeight="300" fontSize="displayMd" lineHeight="1" color="fg">
          Importa tus conversaciones.
        </Text>
        <Text fontSize="15px" color="fg.muted" mt="3" lineHeight="1.6" maxW="56ch">
          Pega el JSON de tu export de ChatGPT (o súbelo luego en Fuentes). Extraemos lo que importa
          y lo clasificamos en áreas.
        </Text>
      </Box>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Pega aquí el contenido de tu export…"
        rows={8}
        resize="none"
      />
      <HStack>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={15} /> Atrás
        </Button>
        <Button colorPalette="ink" ms="auto" onClick={submit} loading={busy}>
          Importar <ArrowRight size={15} />
        </Button>
      </HStack>
    </Stack>
  );
}

function RescueStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadPrompt() {
    setBusy(true);
    try {
      const { prompt: p } = await api.onboarding.rescuePrompt();
      setPrompt(p);
    } catch {
      notify.error("No pudimos generar el prompt.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (answer.trim().length < 20) return notify.error("Pega la respuesta de tu IA.");
    setBusy(true);
    try {
      const { count } = await api.onboarding.ingestRescue(answer);
      notify.success("Memoria rescatada", `${count} recuerdos sumados.`);
      onDone();
    } catch {
      notify.error("No pudimos rescatar.");
      setBusy(false);
    }
  }

  return (
    <Stack gap="5" maxW="680px" mx="auto" w="full">
      <Box>
        <Text fontWeight="300" fontSize="displayMd" lineHeight="1" color="fg">
          Rescata lo que tu IA ya sabe.
        </Text>
        <Text fontSize="15px" color="fg.muted" mt="3" lineHeight="1.6" maxW="56ch">
          Copia este prompt, pégalo en tu IA y trae la respuesta. Savia la convierte en recuerdos.
        </Text>
      </Box>

      {!prompt ? (
        <Button colorPalette="ink" alignSelf="flex-start" onClick={loadPrompt} loading={busy}>
          <Sparkles size={16} /> Generar prompt
        </Button>
      ) : (
        <>
          <CopyBlock value={prompt} copyLabel="Copiar prompt" />
          <Box>
            <Text fontSize="14px" fontWeight="600" color="fg" mb="2">
              Pega aquí la respuesta de tu IA
            </Text>
            <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={7} resize="none" placeholder="Pega la respuesta…" />
          </Box>
        </>
      )}

      <HStack>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft size={15} /> Atrás
        </Button>
        {prompt ? (
          <Button colorPalette="ink" ms="auto" onClick={submit} loading={busy}>
            <Check size={15} /> Rescatar
          </Button>
        ) : null}
      </HStack>
    </Stack>
  );
}
