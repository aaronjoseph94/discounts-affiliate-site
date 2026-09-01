# Codes — discount & affiliate site

A fast, mobile-first site for discount codes and affiliate links. Add a product name, optional affiliate URL, optional code, and percent off. Brand logos are looked up automatically.

## Local

```bash
npm install
npm run dev
```

- Public site: [http://localhost:5173](http://localhost:5173)
- Admin: [http://localhost:5173/admin](http://localhost:5173/admin)
- Default local password: `admin`

Deals you save locally are written to `data/deals.json`.

```bash
npm test
npm run typecheck
```

## Admin

`/admin` is a one-screen backend:

1. Product name
2. Affiliate URL (optional)
3. Discount code (optional)
4. % discount (optional)

Type a brand name and the logo search fills in as you go. Pick a match if more than one comes back.

## Deploy to Netlify

This repo is already set up for Netlify (`netlify.toml`, functions, SPA routing).

1. Push this GitHub repo.
2. In Netlify: **Add new site → Import an existing project**.
3. Set the environment variable `ADMIN_PASSWORD` to a strong unique value. Production refuses `admin`.
4. Deploy.

After the first deploy, new deals are stored in Netlify Blobs so they persist across publishes. The sample deals ship with the app so the homepage is not empty on first load.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/deals` | no | List deals |
| POST | `/api/deals` | admin | Create a deal |
| PATCH | `/api/deals/:id` | admin | Update a deal |
| DELETE | `/api/deals/:id` | admin | Delete a deal |
| GET | `/api/logo?name=&url=` | no | Brand logo search |
| POST | `/api/login` | password | Admin session |
| POST | `/api/logout` | cookie | Sign out |

Login is rate-limited. Affiliate URLs must be public `http(s)` hosts. Logo URLs are limited to known CDNs.
