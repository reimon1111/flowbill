import type { CompanySettings } from "@/lib/types";
import {
  resolveDocumentContactName,
  resolveDocumentEmail,
} from "@/lib/document-contact";

export function DocumentCompanyInfo({
  company,
  documentEmail,
  documentContactName,
}: {
  company: CompanySettings;
  documentEmail?: string | null;
  /** 帳票スナップショットの担当者名（空なら会社の contactName） */
  documentContactName?: string | null;
}) {
  const displayContactName = resolveDocumentContactName(
    documentContactName,
    company.contactName
  );
  const displayEmail = resolveDocumentEmail(documentEmail, company.email);
  return (
    <div className="document-company-info w-full text-left text-[11px] leading-snug text-zinc-800 sm:ml-auto sm:w-[46%] sm:max-w-[400px] sm:shrink-0 sm:text-right">
      {company.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={company.logoUrl}
          alt="ロゴ"
          className="document-company-logo mb-1.5 ml-auto h-auto max-h-20 w-auto max-w-full object-contain object-right"
        />
      ) : null}

      {company.stampUrl ? (
        <div className="document-company-name-row flex items-end justify-end overflow-visible">
          <p className="document-company-name document-company-name-on-stamp relative z-10 translate-x-4 pb-px text-sm font-bold leading-tight text-zinc-900">
            {company.companyName}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company.stampUrl}
            alt="会社印"
            className="document-stamp pointer-events-none -ml-5 size-[3.25rem] shrink-0 object-contain opacity-90"
          />
        </div>
      ) : (
        <p className="document-company-name pb-px text-sm font-bold leading-tight text-zinc-900">
          {company.companyName}
        </p>
      )}

      <div>
        <p className="mt-0.5">
          {company.postalCode ? `〒${company.postalCode} ` : ""}
          {company.address}
        </p>
        {displayContactName ? (
          <p className="mt-0.5">担当：{displayContactName}</p>
        ) : null}
        {company.phone ? <p>TEL {company.phone}</p> : null}
        {company.fax ? <p>FAX {company.fax}</p> : null}
        {displayEmail ? <p>{displayEmail}</p> : null}
        {company.invoiceNumber ? (
          <p className="mt-0.5">登録番号 {company.invoiceNumber}</p>
        ) : null}
      </div>
    </div>
  );
}
