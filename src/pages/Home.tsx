import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DealCard } from "../components/DealCard.tsx";
import { Toast } from "../components/Toast.tsx";
import { getDeals } from "../lib/api.ts";
import type { Deal } from "../lib/types.ts";

export function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    getDeals()
      .then(({ deals: next }) => {
        if (alive) setDeals(next);
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
      [deal.productName, deal.discountCode, deal.domain].join(" ").toLowerCase().includes(needle),
    );
  }, [deals, query]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-row">
          <p className="eyebrow">Codes</p>
          <Link className="admin-link" to="/admin">
            Add deals
          </Link>
        </div>
        <h1>Discount codes and affiliate deals, ready to copy.</h1>
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
          <p>{query ? "Try a brand name or code." : "Add your first deal from the admin page."}</p>
          {!query ? (
            <Link className="btn btn-primary" to="/admin">
              Open admin
            </Link>
          ) : null}
        </div>
      ) : (
        <section className="deal-grid">
          {filtered.map((deal) => (
            <DealCard key={deal.id} deal={deal} onCopied={showToast} />
          ))}
        </section>
      )}

      <Toast message={toast} />
    </div>
  );
}
