import { useState } from "react";
import type { Deal } from "../lib/types.ts";
import { BrandLogo } from "./BrandLogo.tsx";

type DealCardProps = {
  deal: Deal;
  onCopied: (message: string) => void;
};

export function DealCard({ deal, onCopied }: DealCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!deal.discountCode) return;
    try {
      await navigator.clipboard.writeText(deal.discountCode);
    } catch {
      const field = document.createElement("textarea");
      field.value = deal.discountCode;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    onCopied(`Copied ${deal.discountCode}`);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <article className="deal-card">
      <div className="deal-card-top">
        <BrandLogo name={deal.productName} src={deal.logoUrl} domain={deal.domain} />
        <div className="deal-card-copy">
          <h2>{deal.productName}</h2>
          {deal.domain ? <p className="deal-domain">{deal.domain}</p> : null}
        </div>
        {deal.discountPercent ? <span className="deal-badge">{deal.discountPercent}% off</span> : null}
      </div>

      {deal.discountCode ? (
        <button type="button" className="code-chip" onClick={() => void copyCode()}>
          <span className="code-label">{copied ? "Copied" : "Code"}</span>
          <strong>{deal.discountCode}</strong>
        </button>
      ) : (
        <p className="code-missing">No code needed — tap through to save</p>
      )}

      <div className="deal-actions">
        {deal.discountCode ? (
          <button type="button" className="btn btn-primary" onClick={() => void copyCode()}>
            {copied ? "Copied" : "Copy code"}
          </button>
        ) : null}
        {deal.affiliateUrl ? (
          <a className="btn btn-secondary" href={deal.affiliateUrl} target="_blank" rel="noreferrer sponsored">
            Shop deal
          </a>
        ) : null}
      </div>
    </article>
  );
}
