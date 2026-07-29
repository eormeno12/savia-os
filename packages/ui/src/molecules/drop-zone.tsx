"use client";

import { Box, FileUpload, Icon } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Upload } from "lucide-react";

export interface DropZoneProps extends FileUpload.RootProps {
  /** Headline inside the drop area. */
  label?: ReactNode;
  /** Secondary hint (accepted types, size). */
  description?: ReactNode;
  /** Show the accepted-files list under the drop area. */
  showList?: boolean;
}

/**
 * Drag-and-drop file area built on Chakra's FileUpload. Presentational only —
 * wire the actual upload via `onFileChange` (presign → S3 → create). Used by
 * onboarding import (O2) and Fuentes (F1).
 */
export function DropZone({
  label = "Arrastra archivos o haz clic para subir",
  description,
  showList = true,
  ...rest
}: DropZoneProps) {
  return (
    <FileUpload.Root alignItems="stretch" {...rest}>
      <FileUpload.HiddenInput />
      <FileUpload.Dropzone borderRadius="card" borderColor="border.subtle">
        <Icon size="md" color="fg.muted">
          <Upload />
        </Icon>
        <FileUpload.DropzoneContent>
          <Box>{label}</Box>
          {description != null && <Box color="fg.muted">{description}</Box>}
        </FileUpload.DropzoneContent>
      </FileUpload.Dropzone>
      {showList && <FileUpload.List showSize clearable />}
    </FileUpload.Root>
  );
}
