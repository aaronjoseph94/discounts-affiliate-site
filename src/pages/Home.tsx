import { useEffect, useMemo, useState } from "react";
import { DealCard } from "../components/DealCard.tsx";
import { Toast } from "../components/Toast.tsx";
import { useToast } from "../hooks/useToast.ts";
import { getDeals, getSettings } from "../lib/api.ts";
import type { Deal } from "../lib/types.ts";

const fallbackTitle = "Discount codes and affiliate deals, ready to copy.";

export function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [title, setTitle] = useState(fallbackTitle);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { message, showToast } = useToast();

  useEffect(() => {
    let alive = true;
    Promise.all([getDeals(), getSettings()])
      .then(([{ deals: next }, { settings }]) => {
        if (!alive) return;
        setDeals(next);
        setTitle(settings.title || fallbackTitle);
        document.title = settings.title || fallbackTitle;
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load deals");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return deals;
    return deals.filter((deal) =>
      [deal.productName, deal.discountCode, deal.domain, deal.affiliateUrl].join(" ").toLowerCase().includes(needle),
    );
  }, [deals, query]);

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-panel">
          <div className="hero-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
              <rect width="32" height="32" rx="9" fill="currentColor" />
              <path d="M10 11h5.2c3 0 4.9 1.8 4.9 4.55S18.2 20.2 15.1 20.2H10V11Zm3.1 2.55v4h1.8c1.6 0 2.5-.85 2.5-2.05s-.9-1.95-2.5-1.95h-1.8Z" fill="#fffdf8" />
              <circle cx="22.2" cy="21.2" r="3.1" stroke="#fffdf8" strokeWidth="2" />
            </svg>
          </div>
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
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>
            <p className="count">{loading ? "Loading…" : `${filtered.length} deal${filtered.length === 1 ? "" : "s"}`}</p>
          </div>
        </div>
      </header>

      {error ? <p className="banner error">{error}</p> : null}

      {!loading && filtered.length === 0 ? (
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
