import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo.tsx";
import { Toast } from "../components/Toast.tsx";
import { useToast } from "../hooks/useToast.ts";
import {
  createDeal,
  deleteDeal,
  getDeals,
  getSession,
  getSettings,
  login,
  logout,
  searchLogos,
  updateDeal,
  updateSettings,
} from "../lib/api.ts";
import type { Deal, LogoHit } from "../lib/types.ts";

const blank = {
  productName: "",
  affiliateUrl: "",
  discountCode: "",
  discountPercent: "",
};

export function Admin() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [hits, setHits] = useState<LogoHit[]>([]);
  const [picked, setPicked] = useState<LogoHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [siteTitle, setSiteTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const { message, showToast } = useToast();

  useEffect(() => {
    let alive = true;
    getSession()
      .then(({ authenticated }) => {
        if (alive) setAuthed(authenticated);
      })
      .catch(() => {
        if (alive) setError("Could not check session");
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    void refreshDeals();
    void getSettings()
      .then(({ settings }) => setSiteTitle(settings.title))
      .catch(() => {
        setError("Could not load site title");
      });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const name = form.productName.trim();
    const url = form.affiliateUrl.trim();
    if (name.length < 2 && url.length < 4) return;

    let alive = true;
    const timer = window.setTimeout(() => {
      void searchLogos(name, url)
        .then(({ results }) => {
          if (!alive) return;
          setHits(results);
          setPicked((current) => current ?? results[0] ?? null);
        })
        .catch(() => {
          if (alive) setHits([]);
        });
    }, 350);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [authed, form.productName, form.affiliateUrl]);

  async function refreshDeals() {
    try {
      const { deals: next } = await getDeals();
      setDeals(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load deals");
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(password);
      setAuthed(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const payload = {
      productName: form.productName,
      affiliateUrl: form.affiliateUrl,
      discountCode: form.discountCode,
      discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
      logoUrl: picked?.logoUrl,
      domain: picked?.domain,
    };
    try {
      if (editingId) {
        await updateDeal(editingId, payload);
        showToast("Deal updated");
      } else {
        await createDeal(payload);
        showToast("Deal added");
      }
      setForm(blank);
      setEditingId(null);
      setHits([]);
      setPicked(null);
      await refreshDeals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save deal");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(deal: Deal) {
    setEditingId(deal.id);
    setForm({
      productName: deal.productName,
      affiliateUrl: deal.affiliateUrl,
      discountCode: deal.discountCode,
      discountPercent: deal.discountPercent ? String(deal.discountPercent) : "",
    });
    setPicked(deal.domain ? { name: deal.productName, domain: deal.domain, logoUrl: deal.logoUrl } : null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this deal?")) return;
    setError("");
    try {
      await deleteDeal(id);
      if (editingId === id) {
        setEditingId(null);
        setForm(blank);
        setPicked(null);
      }
      await refreshDeals();
      showToast("Deal deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete deal");
    }
  }

  if (checking) {
    return (
      <div className="page admin">
        <p className="count">Checking session…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="page admin">
        <header className="hero">
          <Link className="back" to="/">
            ← All deals
          </Link>
          <h1>Admin</h1>
          <p className="lede">Add brands, codes, and affiliate links.</p>
        </header>
        <form className="card-form" onSubmit={(event) => void handleLogin(event)}>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          {error ? <p className="banner error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="page admin">
      <header className="hero">
        <div className="hero-row">
          <Link className="back" to="/">
            ← All deals
          </Link>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              void logout().then(() => setAuthed(false));
            }}
          >
            Sign out
          </button>
        </div>
        <h1>{editingId ? "Edit deal" : "Add a deal"}</h1>
        <p className="lede">Type a product name. The brand logo is pulled in automatically.</p>
      </header>

      <form
        className="card-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSavingTitle(true);
          void updateSettings({ title: siteTitle })
            .then(({ settings }) => {
              setSiteTitle(settings.title);
              showToast("Title saved");
            })
            .catch((err) => {
              setError(err instanceof Error ? err.message : "Could not save title");
            })
            .finally(() => setSavingTitle(false));
        }}
      >
        <label>
          Site title
          <input
            value={siteTitle}
            onChange={(event) => setSiteTitle(event.target.value)}
            maxLength={140}
            required
            autoComplete="off"
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={savingTitle || !siteTitle.trim()}>
          {savingTitle ? "Saving…" : "Save title"}
        </button>
      </form>

      <form className="card-form" onSubmit={(event) => void handleSave(event)}>
        <div className="logo-preview">
          <BrandLogo
            name={form.productName || "Brand"}
            src={picked?.logoUrl}
            domain={picked?.domain}
          />
          <div>
            <p className="logo-kicker">Brand logo</p>
            <strong>{picked?.name || "Searching as you type"}</strong>
            <p className="deal-domain">{picked?.domain || "Add a name or URL"}</p>
          </div>
        </div>

        <label>
          Product name
          <input
            value={form.productName}
            onChange={(event) => {
              setPicked(null);
              setForm((current) => ({ ...current, productName: event.target.value }));
            }}
            placeholder="Nike, NordVPN, Adobe…"
            required
            maxLength={80}
            autoComplete="off"
          />
        </label>

        <label>
          Affiliate URL
          <input
            type="text"
            inputMode="url"
            value={form.affiliateUrl}
            onChange={(event) => {
              setPicked(null);
              setForm((current) => ({ ...current, affiliateUrl: event.target.value }));
            }}
            placeholder="https://…"
            maxLength={500}
            autoComplete="off"
          />
        </label>

        <div className="form-row">
          <label>
            Discount code
            <input
              value={form.discountCode}
              onChange={(event) => setForm((current) => ({ ...current, discountCode: event.target.value }))}
              placeholder="SAVE20"
              maxLength={40}
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
          <label>
            % discount
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={form.discountPercent}
              onChange={(event) => setForm((current) => ({ ...current, discountPercent: event.target.value }))}
              placeholder="25"
            />
          </label>
        </div>

        {(form.productName.trim().length >= 2 || form.affiliateUrl.trim().length >= 4) && hits.length > 1 ? (
          <div className="logo-picks" role="list">
            {hits.map((hit) => (
              <button
                key={hit.domain}
                type="button"
                className={picked?.domain === hit.domain ? "logo-pick active" : "logo-pick"}
                onClick={() => setPicked(hit)}
              >
                <BrandLogo name={hit.name} src={hit.logoUrl} domain={hit.domain} size="sm" />
                <span>{hit.name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="banner error">{error}</p> : null}

        <div className="deal-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Add deal"}
          </button>
          {editingId ? (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(blank);
                setPicked(null);
                setHits([]);
                setError("");
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <section className="admin-list">
        <h2>Your deals</h2>
        {deals.length === 0 ? <p className="lede">Nothing saved yet.</p> : null}
        {deals.map((deal) => (
          <article key={deal.id} className="admin-row">
            <BrandLogo name={deal.productName} src={deal.logoUrl} domain={deal.domain} size="sm" />
            <div className="admin-row-copy">
              <strong>{deal.productName}</strong>
              <p>
                {deal.discountPercent ? `${deal.discountPercent}%` : "Deal"}
                {deal.discountCode ? ` · ${deal.discountCode}` : ""}
              </p>
            </div>
            <div className="admin-row-actions">
              <button type="button" className="text-btn" onClick={() => startEdit(deal)}>
                Edit
              </button>
              <button type="button" className="text-btn danger" onClick={() => void handleDelete(deal.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>

      <Toast message={message} />
    </div>
  );
}
