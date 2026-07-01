import { toast } from "sonner";
import { isMobileViewport } from "@/hooks/use-is-mobile";

type DocumentExportOptions = {
  /** モバイルでプレビューを開くコールバック */
  onOpenPreview?: () => void;
};

export function getDocumentExportLabel(): string {
  return isMobileViewport() ? "PDFを保存" : "印刷 / PDF保存";
}

function showMobilePdfHelpToast(): void {
  toast.info("PDFの保存方法", {
    description:
      "プレビュー画面の共有メニュー（□↑）から「PDFとして保存」を選んでください。",
    duration: 10000,
    classNames: {
      toast: "print-hidden",
    },
  });
}

export function handleDocumentExport(options: DocumentExportOptions = {}): void {
  const mobile = isMobileViewport();

  if (mobile) {
    options.onOpenPreview?.();

    window.setTimeout(() => {
      const preview = document.querySelector<HTMLElement>(".print-area");
      preview?.scrollIntoView({ behavior: "smooth", block: "start" });

      let helpShown = false;
      const showHelpOnce = () => {
        if (helpShown) return;
        helpShown = true;
        showMobilePdfHelpToast();
      };

      window.addEventListener("afterprint", showHelpOnce, { once: true });

      try {
        window.print();
      } catch {
        /* Safari 等で print が失敗しても案内は表示する */
      }

      // afterprint が発火しない環境（iOS Safari 等）向けの遅延案内
      window.setTimeout(showHelpOnce, 2000);
    }, 350);
    return;
  }

  toast.message("印刷画面を開きます。保存先でPDFを選択できます。", {
    classNames: {
      toast: "print-hidden",
    },
  });
  window.print();
}
