"use client";

import { useEffect, useState } from "react";
import { Box, HStack, Link as CkLink, Stack, Text } from "@chakra-ui/react";
import { ExternalLink } from "lucide-react";
import { Skeleton, StatusBadge, type StatusTone } from "@savia-os/ui";
import type { BillingRow } from "@savia-os/contracts";
import { api } from "@/lib/api";
import { SectionCard } from "./section-card";
import { formatMoney, formatShortDate } from "./format";

/** BillingRow.status → readable pill (icon+text via StatusBadge, never color alone). */
const STATUS: Record<BillingRow["status"], { tone: StatusTone; label: string }> = {
  approved: { tone: "success", label: "Pagado" },
  rejected: { tone: "danger", label: "Rechazado" },
  refunded: { tone: "neutral", label: "Reembolsado" },
  pending: { tone: "warning", label: "Pendiente" },
};

type State =
  | { status: "loading" }
  | { status: "hidden" }
  | { status: "ready"; rows: BillingRow[] };

/**
 * Billing history (part of CT2). Reads `GET /billing/payments`. Loading shows
 * skeleton rows with the real anatomy; a hard failure (endpoint missing / 404 /
 * network) hides the whole card gracefully so a half-built backend never breaks
 * the page; empty shows a warm forward-looking line.
 */
export function BillingHistory({ active }: { active: boolean }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    api.billing
      .payments()
      .then((rows) => !cancelled && setState({ status: "ready", rows }))
      .catch(() => !cancelled && setState({ status: "hidden" }));
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "hidden") return null;

  if (state.status === "loading") {
    return (
      <SectionCard label="Facturación">
        <Stack gap="3.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h="44px" rounded="lg" />
          ))}
        </Stack>
      </SectionCard>
    );
  }

  if (state.rows.length === 0) {
    return (
      <SectionCard label="Facturación">
        <Text fontSize="14px" color="fg.muted" lineHeight="1.6" maxW="54ch">
          {active
            ? "Aún no hay cargos registrados. Aquí aparecerá cada factura."
            : "Aquí aparecerán tus facturas cuando actives la suscripción."}
        </Text>
      </SectionCard>
    );
  }

  return (
    <SectionCard label="Facturación">
      <Stack gap="0">
        {state.rows.map((row, i) => {
          const s = STATUS[row.status];
          return (
            <HStack
              key={row.id}
              justify="space-between"
              align="center"
              flexWrap="wrap"
              gap="3"
              py="3.5"
              borderTopWidth={i === 0 ? "0" : "1px"}
              borderColor="border.subtle"
            >
              <Stack gap="0.5" minW="0">
                <Text
                  fontSize="14px"
                  fontWeight="500"
                  color="fg"
                  fontVariantNumeric="tabular-nums"
                >
                  {formatShortDate(row.date)}
                </Text>
                <Text fontSize="12px" color="fg.muted">
                  {row.period}
                </Text>
              </Stack>
              <HStack gap="3.5" flexShrink="0" align="center">
                <Text fontSize="14px" color="fg" fontVariantNumeric="tabular-nums">
                  {formatMoney(row.amount, row.currency)}
                </Text>
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                {row.receiptUrl ? (
                  <CkLink
                    href={row.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    fontSize="13px"
                    color="fg.muted"
                    _hover={{ color: "fg" }}
                  >
                    <Box as="span" display="inline-flex" alignItems="center" gap="1">
                      Ver comprobante
                      <ExternalLink size={13} />
                    </Box>
                  </CkLink>
                ) : null}
              </HStack>
            </HStack>
          );
        })}
      </Stack>
    </SectionCard>
  );
}
