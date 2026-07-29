"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Box, HStack, Link as CkLink, Stack, Text } from "@chakra-ui/react";
import { FileText } from "lucide-react";
import { DropZone, Skeleton, StatusBadge, notify, type StatusTone } from "@savia-os/ui";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload";

type FileItem = Awaited<ReturnType<typeof api.files.list>>[number];

/** Poll cadence while any source is still being absorbed. */
const POLL_MS = 5000;

const STATUS: Record<FileItem["status"], { tone: StatusTone; label: string }> = {
  pending: { tone: "neutral", label: "En cola" },
  processing: { tone: "warning", label: "Destilando recuerdos…" },
  indexed: { tone: "success", label: "Absorbida" },
  failed: { tone: "danger", label: "No pudimos leerla" },
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * F1 — Fuentes: drop files and watch Savia absorb them into your memory. The
 * upload flow is presign → S3 → register; the list reflects ingest status.
 */
export function FuentesScreen() {
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [areaNames, setAreaNames] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(0);

  const load = useCallback(() => {
    api.files.list().then(setFiles).catch(() => setFiles([]));
  }, []);

  useEffect(() => load(), [load]);

  useEffect(() => {
    api.areas.list().then((a) => setAreaNames(new Map(a.map((x) => [x.id, x.name])))).catch(() => {});
  }, []);

  // While anything is still being absorbed, poll so the status flips to
  // "Absorbida" without a manual refresh — the absorption is visible.
  const inFlight = files?.some((f) => f.status === "pending" || f.status === "processing") ?? false;
  const savedLoad = useRef(load);
  savedLoad.current = load;
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => savedLoad.current(), POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight]);

  const onFiles = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      setUploading((n) => n + accepted.length);
      // Uploads land in the default ("General") area; the API requires an areaId.
      let areaId: string | undefined;
      try {
        const areas = await api.areas.list();
        areaId = (areas.find((a) => a.isDefault) ?? areas[0])?.id;
      } catch {
        areaId = undefined;
      }
      if (!areaId) {
        setUploading((n) => n - accepted.length);
        notify.error("No pudimos subir los archivos");
        return;
      }
      const target = areaId;
      await Promise.all(
        accepted.map(async (f) => {
          try {
            await uploadFile(f, target);
          } catch {
            notify.error(`No pudimos subir ${f.name}`);
          } finally {
            setUploading((n) => n - 1);
          }
        }),
      );
      notify.success("Fuentes sumadas", "Savia las está absorbiendo a tu memoria.");
      load();
    },
    [load],
  );

  return (
    <Stack gap="6" maxW="820px">
      <Box>
        <Text textStyle="label" color="fg.muted">
          Fuentes
        </Text>
        <Text fontWeight="300" fontSize="displayMd" lineHeight="1" color="fg" mt="2.5">
          Suma todo lo que sabes.
        </Text>
        <Text fontSize="15px" color="fg.muted" mt="3" maxW="56ch" lineHeight="1.6">
          Sube documentos, notas o exportaciones. Savia los lee, extrae lo que importa y los
          clasifica en tus áreas, solo.
        </Text>
      </Box>

      <DropZone
        maxFiles={20}
        accept={[".pdf", ".txt", ".md", ".docx", ".csv", ".json"]}
        label="Arrastra aquí documentos, notas, lo que quieras recordar"
        description="Savia lo organiza en tu memoria · PDF, TXT, MD, DOCX, CSV o JSON"
        showList={false}
        onFileChange={(d) => onFiles(d.acceptedFiles)}
      />

      {uploading > 0 ? (
        <Text fontSize="13px" color="fg.muted">
          Subiendo {uploading} {uploading === 1 ? "archivo" : "archivos"}…
        </Text>
      ) : null}

      <Box>
        <Text textStyle="label" color="fg.muted" mb="3">
          Tus fuentes
        </Text>
        {files === null ? (
          <Stack gap="2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h="60px" rounded="2xl" />
            ))}
          </Stack>
        ) : files.length === 0 ? (
          <Stack
            align="center"
            textAlign="center"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border"
            rounded="3xl"
            py="16"
            gap="0"
          >
            <Box color="fg.muted">
              <FileText size={36} strokeWidth={1.3} />
            </Box>
            <Text fontSize="15px" color="fg.muted" mt="4" maxW="40ch" lineHeight="1.6">
              Todavía no sumaste fuentes. Lo que subas aparecerá aquí mientras Savia lo procesa.
            </Text>
          </Stack>
        ) : (
          <Stack gap="2.5">
            {files.map((f) => {
              const st = STATUS[f.status];
              return (
                <HStack key={f.id} gap="3.5" bg="bg.panel" borderWidth="1px" borderColor="border" rounded="2xl" px="5" py="3.5">
                  <Box w="9" h="9" rounded="xl" bg="bg.subtle" color="fg.muted" display="flex" alignItems="center" justifyContent="center" flexShrink="0">
                    <FileText size={18} />
                  </Box>
                  <Box flex="1" minW="0">
                    <Text fontSize="14px" fontWeight="500" color="fg" truncate>
                      {f.name}
                    </Text>
                    <HStack gap="1.5" mt="0.5" flexWrap="wrap">
                      <Text fontSize="12px" color="fg.muted">
                        {fmtSize(f.sizeBytes)}
                        {f.status === "indexed" && f.memoryCount != null
                          ? ` · ${f.memoryCount} ${f.memoryCount === 1 ? "recuerdo" : "recuerdos"}`
                          : ""}
                      </Text>
                      {f.status === "indexed" && areaNames.has(f.areaId) ? (
                        <Text fontSize="12px" color="fg.muted">
                          {"→ "}
                          <CkLink asChild color="fg" fontWeight="500">
                            <Link href={`/memoria/${f.areaId}`}>{areaNames.get(f.areaId)}</Link>
                          </CkLink>
                        </Text>
                      ) : null}
                    </HStack>
                  </Box>
                  <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                </HStack>
              );
            })}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
