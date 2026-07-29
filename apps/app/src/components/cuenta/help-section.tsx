"use client";

import { useState } from "react";
import { Accordion, Box, Button, HStack, Input, Span, Stack, Text, Textarea } from "@chakra-ui/react";
import { Field, notify } from "@savia-os/ui";
import { SectionCard } from "./section-card";

const FAQ = [
  {
    q: "¿Por qué mi IA no ve ciertos recuerdos?",
    a: "Por defecto, tus IAs no ven nada. Tú decides qué áreas puede leer cada una desde Conexiones. Y los recuerdos que marcaste como sensibles quedan fuera salvo que des acceso explícito.",
  },
  {
    q: "¿Cómo exporto mis datos?",
    a: "Arriba, en «Tus datos», pide una exportación. Preparamos un archivo con toda tu memoria en JSON y CSV y te avisamos en la Bandeja cuando el enlace esté listo. El enlace vale 48 horas.",
  },
  {
    q: "¿Cómo cancelo mi suscripción?",
    a: "Desde «Plan», usa «Cancelar suscripción». Tu acceso continúa hasta el final del período que ya pagaste; después tus IAs se desconectan, pero tu memoria se conserva.",
  },
  {
    q: "¿Qué pasa con mis datos si elimino mi cuenta?",
    a: "Se borran de forma permanente: toda tu memoria, tus áreas y tus conexiones. No podemos recuperarlos después. Si crees que podrías volver, exporta primero.",
  },
];

const CATEGORIES = [
  { value: "bug", label: "Algo no funciona" },
  { value: "question", label: "Tengo una pregunta" },
  { value: "idea", label: "Quiero sugerir algo" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

/**
 * Deterministic ticket number from the message shape (no Math.random / Date.now,
 * so it stays stable and testable). Drops in as the reference the user quotes.
 */
function ticketId(category: string, subject: string, message: string): string {
  const seed = (subject.length * 31 + message.length * 7 + category.length) % 100000;
  return `SV-${seed.toString().padStart(5, "0")}`;
}

/**
 * CT4 — Ayuda y soporte. A collapsible FAQ answering the four questions users
 * actually ask, then a contact form. There is no support endpoint yet, so the
 * submit is simulated locally with a deterministic ticket number.
 *
 * Espera endpoint: POST /support/tickets
 *   body: { category: "bug" | "question" | "idea", subject: string, message: string }
 *   → { ticketId: string }
 */
export function HelpSection() {
  const [category, setCategory] = useState<Category>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const s = subject.trim();
    const m = message.trim();
    if (!s || !m) {
      setError("Cuéntanos el asunto y el mensaje.");
      return;
    }
    // Simulated send (see the espera endpoint note above). When the backend
    // exists, replace this block with:
    //   await api.support.createTicket({ category, subject: s, message: m })
    const id = ticketId(category, s, m);
    notify.success(
      "Recibimos tu mensaje.",
      `Te responderemos a tu email en menos de 48 h · Ticket ${id}`,
    );
    setSubject("");
    setMessage("");
    setCategory("bug");
    setError(null);
  }

  return (
    <SectionCard label="Ayuda y soporte">
      <Text fontSize="14px" color="fg.muted" lineHeight="1.6" maxW="56ch">
        Primero, lo que más nos preguntan. Si no encuentras tu respuesta, escríbenos abajo.
      </Text>

      <Accordion.Root collapsible>
        {FAQ.map((item, i) => (
          <Accordion.Item key={item.q} value={String(i)} borderColor="border">
            <Accordion.ItemTrigger py="4" cursor="pointer">
              <Span flex="1" textAlign="start" fontSize="15px" fontWeight="500" color="fg">
                {item.q}
              </Span>
              <Accordion.ItemIndicator color="fg.muted" />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody pb="4">
                <Text fontSize="14px" color="fg.muted" lineHeight="1.7" maxW="62ch">
                  {item.a}
                </Text>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        ))}
      </Accordion.Root>

      <Box h="1px" bg="border" mt="1" />

      <Stack gap="4" mt="1">
        <Stack gap="1.5">
          <Text textStyle="cardTitle" color="fg">
            ¿Necesitas más ayuda?
          </Text>
          <Text fontSize="14px" color="fg.muted" lineHeight="1.6" maxW="56ch">
            Escríbenos y te respondemos a tu email.
          </Text>
        </Stack>

        <Stack gap="2.5">
          <Text textStyle="label" color="fg.muted">
            ¿De qué se trata?
          </Text>
          <HStack gap="2.5" flexWrap="wrap">
            {CATEGORIES.map((c) => {
              const selected = category === c.value;
              return (
                <Button
                  key={c.value}
                  type="button"
                  size="sm"
                  variant={selected ? "solid" : "outline"}
                  colorPalette="ink"
                  aria-pressed={selected}
                  onClick={() => setCategory(c.value)}
                >
                  {c.label}
                </Button>
              );
            })}
          </HStack>
        </Stack>

        <Field label="Asunto">
          <Input
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Cuéntanos en una línea"
            maxLength={120}
          />
        </Field>

        <Field label="Mensaje" error={error ?? undefined}>
          <Textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Danos los detalles. Cuanto más nos cuentes, mejor te ayudamos."
            rows={5}
            resize="none"
          />
        </Field>

        <Button colorPalette="ink" alignSelf="flex-start" onClick={submit}>
          Enviar
        </Button>
      </Stack>
    </SectionCard>
  );
}
