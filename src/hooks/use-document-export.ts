"use client";

import { useCallback, useState } from "react";
import { handleDocumentExport } from "@/lib/document-export";

export function useDocumentExport() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lineGuideOpen, setLineGuideOpen] = useState(false);

  const onExport = useCallback(() => {
    handleDocumentExport({
      onOpenPreview: () => setPreviewOpen(true),
      onLineInAppGuide: () => setLineGuideOpen(true),
    });
  }, []);

  return {
    previewOpen,
    setPreviewOpen,
    lineGuideOpen,
    setLineGuideOpen,
    onExport,
  };
}
