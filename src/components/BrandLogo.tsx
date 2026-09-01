/** Brand mark with CDN fallbacks, then initials if every image fails. */
import { useState } from "react";

type BrandLogoProps = {
  name: string;
  src?: string;
  domain?: string;
  size?: "sm" | "md";
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function fallbacks(src?: string, domain?: string): string[] {
  const urls: string[] = [];
  if (src) urls.push(src);
  if (domain) {
    urls.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    urls.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);
  }
  return [...new Set(urls)];
}

function BrandLogoInner({ name, src, domain, size = "md" }: BrandLogoProps) {
  const [index, setIndex] = useState(0);
  const urls = fallbacks(src, domain);
  const current = urls[index];

  if (!current) {
    return <div className={`brand-logo fallback ${size}`}>{initials(name)}</div>;
  }

  return (
    <img
      className={`brand-logo ${size}`}
      src={current}
      alt=""
      width={size === "sm" ? 36 : 52}
      height={size === "sm" ? 36 : 52}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setIndex((value) => value + 1)}
    />
  );
}

export function BrandLogo(props: BrandLogoProps) {
  return <BrandLogoInner key={`${props.src ?? ""}:${props.domain ?? ""}`} {...props} />;
}
