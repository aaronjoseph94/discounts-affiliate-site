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
        <h1>{title}</h1>
        <label className="search">
          <span className="sr-only">Search deals</span>
          <input
            type="search"
            placeholder="Search brands or codes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        <p className="count">{loading ? "Loading deals…" : `${filtered.length} deal${filtered.length === 1 ? "" : "s"}`}</p>
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
