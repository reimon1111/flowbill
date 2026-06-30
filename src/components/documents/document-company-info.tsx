import type { CompanySettings } from "@/lib/types";

export function DocumentCompanyInfo({ company }: { company: CompanySettings }) {
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
        {company.contactName ? <p className="mt-0.5">担当 {company.contactName}</p> : null}
        {company.phone ? <p>TEL {company.phone}</p> : null}
        {company.fax ? <p>FAX {company.fax}</p> : null}
        {company.email ? <p>mail {company.email}</p> : null}
        {company.invoiceNumber ? (
          <p className="mt-0.5">登録番号 {company.invoiceNumber}</p>
        ) : null}
      </div>
    </div>
  );
}
