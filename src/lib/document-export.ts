import { toast } from "sonner";
import { isMobileViewport } from "@/hooks/use-is-mobile";

type DocumentExportOptions = {
  /** モバイルでプレビューを開くコールバック */
  onOpenPreview?: () => void;
};

export function getDocumentExportLabel(): string {
  return isMobileViewport() ? "PDFを保存" : "印刷 / PDF保存";
}

export function handleDocumentExport(options: DocumentExportOptions = {}): void {
  const mobile = isMobileViewport();

  if (mobile) {
    options.onOpenPreview?.();

    window.setTimeout(() => {
      const preview = document.querySelector<HTMLElement>(
        ".print-area, .document-preview"
      );
      preview?.scrollIntoView({ behavior: "smooth", block: "start" });

      try {
        window.print();
      } catch {
        /* Safari 等で print が失敗しても案内は表示する */
      }

      toast.info("PDFの保存方法", {
        description:
          "印刷画面が開かない場合は、プレビュー表示後にブラウザの共有メニュー（□↑）から「PDFとして保存」を選んでください。",
        duration: 10000,
      });
    }, mobile ? 350 : 0);
    return;
  }

  toast.message("印刷画面を開きます。保存先でPDFを選択できます。");
  window.print();
}
