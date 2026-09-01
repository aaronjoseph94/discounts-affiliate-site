/** Public homepage: search deals, copy a code, tap through to the shop. */
import { useEffect, useMemo, useState } from "react";
import { DealCard } from "../components/DealCard.tsx";
import { Toast } from "../components/Toast.tsx";
import { useToast } from "../hooks/useToast.ts";
import { getDeals, getSettings } from "../lib/api.ts";
import { DEFAULT_TAGLINE, SITE_NAME, pageTitle } from "../lib/brand.ts";
import type { Deal } from "../lib/types.ts";

export function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [title, setTitle] = useState(DEFAULT_TAGLINE);
  const [logoUrl, setLogoUrl] = useState("/logo.png");
  const [logoFailed, setLogoFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { message, showToast } = useToast();

  useEffect(() => {
    document.title = pageTitle();
    let alive = true;
    Promise.allSettled([getDeals(), getSettings()]).then(([dealsRes, settingsRes]) => {
      if (!alive) return;
      if (dealsRes.status === "fulfilled") {
        setDeals(dealsRes.value.deals);
      } else {
        setError(dealsRes.reason instanceof Error ? dealsRes.reason.message : "Could not load deals");
      }
      if (settingsRes.status === "fulfilled") {
        setTitle(settingsRes.value.settings.title || DEFAULT_TAGLINE);
        setLogoUrl(settingsRes.value.settings.logoUrl || "/logo.png");
        setLogoFailed(false);
      }
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().slice(0, 80);
    if (!needle) return deals;
    return deals.filter((deal) =>
      [deal.productName, deal.discountCode, deal.domain, deal.affiliateUrl].join(" ").toLowerCase().includes(needle),
    );
  }, [deals, query]);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-panel">
          <img
            className="hero-logo"
            src={logoFailed ? "/logo.png" : logoUrl}
            alt={SITE_NAME}
            onError={() => setLogoFailed(true)}
          />
          <h1>{title}</h1>
          <div className="hero-tools">
            <label className="search">
              <span className="sr-only">Search deals</span>
              <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M16.2 16.2 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Search brands or codes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={80}
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>
            <p className="count">{loading ? "Loading…" : `${filtered.length} deal${filtered.length === 1 ? "" : "s"}`}</p>
          </div>
        </div>
      </header>

      {error ? <p className="banner error">{error}</p> : null}

      {loading ? null : filtered.length === 0 ? (
        <div className="empty">
          <h2>{query ? "No matches" : "No deals yet"}</h2>
          <p>{query ? "Try a brand name or code." : "Check back soon."}</p>
        </div>
      ) : (
        <section className="deal-grid" aria-live="polite">
          {filtered.map((deal) => (
            <DealCard key={deal.id} deal={deal} onCopied={showToast} />
          ))}
        </section>
      )}

      <Toast message={message} />
    </div>
  );
}
