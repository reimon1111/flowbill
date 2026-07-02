import { toast } from "sonner";
import { isLineInAppBrowser } from "@/lib/browser-environment";
import { isMobileViewport } from "@/hooks/use-is-mobile";

type DocumentExportOptions = {
  /** モバイルでプレビューを開くコールバック */
  onOpenPreview?: () => void;
  /** LINE 内ブラウザ向けの案内バナーを表示 */
  onLineInAppGuide?: () => void;
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

function showLineInAppPdfHelpToast(): void {
  toast.info("LINEアプリ内ブラウザではPDF保存画面を開けません", {
    description:
      "右上の「⋯」から「ブラウザで開く」を選び、Safari または Chrome で再度お試しください。",
    duration: 12000,
    classNames: {
      toast: "print-hidden",
    },
  });
}

function openPreviewAndScroll(): void {
  const preview = document.querySelector<HTMLElement>(".print-area");
  preview?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToLineGuide(): void {
  window.setTimeout(() => {
    document
      .getElementById("line-pdf-export-guide")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 150);
}

/** LINE 内ブラウザ: print() は使わずプレビュー表示 + 外部ブラウザ案内のみ */
function handleLineInAppPdfExport(options: DocumentExportOptions): void {
  options.onOpenPreview?.();

  window.setTimeout(() => {
    openPreviewAndScroll();
    options.onLineInAppGuide?.();
    showLineInAppPdfHelpToast();
    scrollToLineGuide();
  }, 350);
}

export function handleDocumentExport(options: DocumentExportOptions = {}): void {
  if (isLineInAppBrowser()) {
    handleLineInAppPdfExport(options);
    return;
  }

  const mobile = isMobileViewport();

  if (mobile) {
    options.onOpenPreview?.();

    window.setTimeout(() => {
      openPreviewAndScroll();

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
