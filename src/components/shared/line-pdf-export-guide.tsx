"use client";

type LinePdfExportGuideProps = {
  open: boolean;
  onClose?: () => void;
  id?: string;
};

export function LinePdfExportGuide({
  open,
  onClose,
  id = "line-pdf-export-guide",
}: LinePdfExportGuideProps) {
  if (!open) return null;

  return (
    <div
      id={id}
      className="print-hidden rounded-xl border border-amber-200/80 bg-amber-50 px-5 py-4 text-sm text-amber-950"
    >
      <p className="font-medium">LINEアプリ内ブラウザではPDFを直接保存できません</p>
      <p className="mt-2 leading-relaxed text-amber-900/90">
        次の手順で外部ブラウザから保存してください。
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed text-amber-900/90">
        <li>画面右上の「⋯」メニューを開く</li>
        <li>「ブラウザで開く」を選ぶ（Safari または Chrome）</li>
        <li>開いたブラウザで帳票プレビューを確認し、「PDFを保存」を押す</li>
      </ol>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm font-medium text-amber-900 underline underline-offset-2"
        >
          閉じる
        </button>
      ) : null}
    </div>
  );
}
