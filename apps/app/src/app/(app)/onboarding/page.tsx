"use client";

import { useState } from "react";
import { Box, Text, VStack, HStack, Button, Badge, Separator } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { RescueStep } from "@/components/onboarding/RescueStep";
import { ImportStep } from "@/components/onboarding/ImportStep";
import { SuggestedSpaces } from "@/components/onboarding/SuggestedSpaces";
import { MessageSquare, Upload, Layers, Zap } from "lucide-react";

type WizardStep = "welcome" | "rescue" | "import" | "suggest" | "done";

const STEPS = [
  { id: "welcome", label: "Bienvenida" },
  { id: "import", label: "Importar" },
  { id: "suggest", label: "Spaces" },
  { id: "done", label: "Conectar" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("welcome");
  const [importMode, setImportMode] = useState<"rescue" | "chatgpt" | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.id === step || (step === "rescue" && s.id === "import"));

  function goSuggest() { setStep("suggest"); }
  function goDone() { setStep("done"); }

  return (
    <Box maxW="600px" mx="auto" py="10" px="4">
      {/* Progress */}
      <HStack gap="1" mb="8">
        {STEPS.map((s, i) => (
          <HStack key={s.id} gap="1" flex="1" align="center">
            <Box
              h="2"
              flex="1"
              borderRadius="full"
              bg={i <= stepIndex ? "brand.solid" : "border.subtle"}
              transition="background 0.2s"
            />
            <Text fontSize="xs" color={i <= stepIndex ? "fg" : "fg.muted"} whiteSpace="nowrap">
              {s.label}
            </Text>
          </HStack>
        ))}
      </HStack>

      <VStack align="stretch" gap="6">
        {/* STEP: Welcome */}
        {step === "welcome" && (
          <>
            <Box>
              <Text fontSize="2xl" fontWeight="800" color="fg" mb="2">
                Bienvenido a Savia
              </Text>
              <Text color="fg.muted">
                La memoria que conecta todas tus IAs. Empieza importando lo que ya
                saben de ti — o conéctate directamente y Savia irá aprendiendo.
              </Text>
            </Box>

            <Separator />

            <VStack align="stretch" gap="3">
              <Text fontSize="sm" fontWeight="600" color="fg">¿Cómo quieres empezar?</Text>

              <Box
                border="1px solid"
                borderColor={importMode === "rescue" ? "brand.solid" : "border.subtle"}
                borderRadius="lg"
                p="4"
                cursor="pointer"
                onClick={() => setImportMode("rescue")}
                _hover={{ borderColor: "brand.solid" }}
                transition="border-color 0.15s"
              >
                <HStack gap="3">
                  <MessageSquare size={20} />
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color="fg">
                      Prompt de rescate
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      Pídele a tu IA actual que resuma todo lo que sabe de ti.
                      El camino más rápido.
                    </Text>
                  </Box>
                  <Badge colorPalette="green" variant="subtle" size="sm" ml="auto">
                    Recomendado
                  </Badge>
                </HStack>
              </Box>

              <Box
                border="1px solid"
                borderColor={importMode === "chatgpt" ? "brand.solid" : "border.subtle"}
                borderRadius="lg"
                p="4"
                cursor="pointer"
                onClick={() => setImportMode("chatgpt")}
                _hover={{ borderColor: "brand.solid" }}
                transition="border-color 0.15s"
              >
                <HStack gap="3">
                  <Upload size={20} />
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color="fg">
                      Export de ChatGPT
                    </Text>
                    <Text fontSize="xs" color="fg.muted">
                      Importa tu historial completo de conversaciones.
                    </Text>
                  </Box>
                </HStack>
              </Box>
            </VStack>

            <HStack justify="flex-end" gap="2">
              <Button variant="ghost" size="sm" onClick={() => setStep("suggest")}>
                Saltar por ahora
              </Button>
              <Button
                size="sm"
                disabled={!importMode}
                onClick={() => setStep(importMode === "rescue" ? "rescue" : "import")}
              >
                Continuar
              </Button>
            </HStack>
          </>
        )}

        {/* STEP: Rescue */}
        {step === "rescue" && (
          <>
            <Box>
              <Text fontSize="lg" fontWeight="700" color="fg" mb="1">
                Prompt de rescate
              </Text>
              <Text fontSize="sm" color="fg.muted">
                Copia el prompt, pégalo en tu IA, y pega aquí la respuesta.
              </Text>
            </Box>
            <RescueStep onDone={goSuggest} />
          </>
        )}

        {/* STEP: ChatGPT import */}
        {step === "import" && (
          <>
            <Box>
              <HStack gap="2" mb="1">
                <Text fontSize="lg" fontWeight="700" color="fg">
                  Import ChatGPT
                </Text>
                <Badge colorPalette="orange" variant="subtle" size="sm">Beta</Badge>
              </HStack>
              <Text fontSize="sm" color="fg.muted">
                Sube tu conversations.json. Savia extrae los hechos relevantes —
                no guarda las conversaciones completas.
              </Text>
            </Box>
            <ImportStep onDone={goSuggest} />
          </>
        )}

        {/* STEP: Suggest spaces */}
        {step === "suggest" && (
          <>
            <Box>
              <HStack gap="2" mb="1">
                <Layers size={18} />
                <Text fontSize="lg" fontWeight="700" color="fg">
                  Tus spaces sugeridos
                </Text>
              </HStack>
              <Text fontSize="sm" color="fg.muted">
                Savia agrupó tus memorias y sugiere estas categorías.
              </Text>
            </Box>
            <SuggestedSpaces onDone={goDone} />
          </>
        )}

        {/* STEP: Done */}
        {step === "done" && (
          <VStack align="flex-start" gap="5">
            <Box>
              <Text fontSize="2xl" fontWeight="800" color="fg" mb="2">
                ¡Todo listo!
              </Text>
              <Text color="fg.muted">
                Tu memoria está en Savia. El siguiente paso es conectar tu IA
                favorita para que pueda buscar en ella.
              </Text>
            </Box>

            <Box
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="lg"
              p="5"
              w="full"
              bg="bg.subtle"
            >
              <HStack gap="3" mb="3">
                <Zap size={18} />
                <Text fontSize="sm" fontWeight="600" color="fg">
                  Conectar tu IA
                </Text>
              </HStack>
              <Text fontSize="xs" color="fg.muted" mb="3">
                Crea una conexión, asigna spaces y copia la config MCP en
                Claude Code, Cursor, o cualquier cliente compatible.
              </Text>
              <HStack gap="2">
                <Button size="sm" onClick={() => router.push("/connections")}>
                  Ir a Conexiones
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push("/drive")}>
                  Ver Drive
                </Button>
              </HStack>
            </Box>
          </VStack>
        )}
      </VStack>
    </Box>
  );
}
