# Inventory Backend

Node.js + TypeScript + Express backend for the inventory management system.  
Database: Supabase (Postgres). Images: Cloudinary. No ORM — raw `supabase-js` queries.

---

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- A Cloudinary account (free tier works)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your `.env`:

| Key | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → service_role key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard → top-left cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard → Settings → API Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard → Settings → API Keys |
| `FRONTEND_URL` | Your React dev server, e.g. `http://localhost:5173` |

> ⚠️ Use the **service_role** key (not anon key) — the backend needs it to bypass RLS and manage auth users.

### 3. Run the SQL migration

1. Open your Supabase project → SQL Editor
2. Paste the contents of `src/sql/migration.sql`
3. Run it — this creates all tables, enums, indexes, and Postgres functions

### 4. Create the first admin user

In Supabase SQL Editor, after migration:

```sql
-- Step 1: Note the UUID after creating auth user below
-- Step 2: Create auth user via Supabase dashboard:
--   Authentication → Users → Add user
--   Email: admin@yourdomain.com, Password: yourpassword
--   Copy the UUID from the user list

-- Step 3: Insert into users table
INSERT INTO users (id, email, name, role)
VALUES ('PASTE-UUID-HERE', 'admin@yourdomain.com', 'Admin', 'ADMIN');
```

Or use the Supabase Auth dashboard to create the user, then copy the UUID into the `users` table insert.

### 5. Start the dev server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

---

## Project structure

```
src/
├── index.ts                    # App entry point, middleware, route wiring
├── lib/
│   ├── supabase.ts             # Supabase client singleton (service role)
│   └── cloudinary.ts           # Cloudinary upload/delete helpers
├── types/
│   └── index.ts                # Shared TypeScript types + Express augmentation
├── middleware/
│   ├── auth.ts                 # JWT validation + role guards
│   ├── errorHandler.ts         # Global error handler + AppError class
│   └── upload.ts               # Multer config for image uploads
├── controllers/
│   ├── auth.controller.ts      # login, logout, refresh
│   ├── users.controller.ts     # Staff account management (admin)
│   ├── categories.controller.ts
│   ├── items.controller.ts     # Stock item CRUD + Cloudinary
│   ├── logs.controller.ts      # Stock received/consumed + history
│   ├── dashboard.controller.ts # Summary, low-stock, chart data
│   ├── export.controller.ts    # Excel + CSV export
│   └── upload.controller.ts    # Standalone image upload
├── routes/
│   ├── auth.routes.ts
│   ├── users.routes.ts
│   ├── categories.routes.ts
│   ├── items.routes.ts
│   ├── logs.routes.ts
│   ├── dashboard.routes.ts
│   ├── export.routes.ts
│   └── upload.routes.ts
└── sql/
    └── migration.sql           # Full DB setup — run once in Supabase SQL Editor
```

---

## API reference

### Auth
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` |
| POST | `/auth/logout` | Bearer | — |
| POST | `/auth/refresh` | — | `{ refresh_token }` |

### Stock items
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/items` | Any | `?search=&category_id=` |
| GET | `/items/:id` | Any | |
| POST | `/items` | Any | `multipart/form-data` with optional `image` field |
| PATCH | `/items/:id` | Any | `multipart/form-data` |
| DELETE | `/items/:id` | Admin | Soft delete |

### Stock logs
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/items/:id/log` | Any | `{ type: RECEIVED\|CONSUMED, quantity, note? }` |
| GET | `/logs` | Any | Staff: today only. Admin: `?from=&to=&item_id=&staff_id=` |

### Users
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/users/me` | Any | Own profile |
| PATCH | `/users/me/password` | Any | `{ new_password }` |
| GET | `/users` | Admin | All staff |
| POST | `/users` | Admin | `{ email, name, password, role? }` |
| PATCH | `/users/:id` | Admin | `{ name?, role? }` |
| PATCH | `/users/:id/deactivate` | Admin | `{ is_active: boolean }` |
| PATCH | `/users/:id/reset-password` | Admin | `{ new_password }` |

### Categories
| Method | Path | Auth |
|---|---|---|
| GET | `/categories` | Any |
| POST | `/categories` | Admin |
| PATCH | `/categories/:id` | Admin |
| DELETE | `/categories/:id` | Admin |

### Dashboard (Admin only)
| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard/summary` | Total items, low stock count, today's updates |
| GET | `/dashboard/low-stock` | Items at or below threshold |
| GET | `/dashboard/chart?days=7` | Daily received/consumed counts |

### Export (Admin only)
| Method | Path | Notes |
|---|---|---|
| GET | `/export/excel?from=YYYY-MM-DD&to=YYYY-MM-DD` | Downloads `.xlsx` |
| GET | `/export/csv?from=YYYY-MM-DD&to=YYYY-MM-DD` | Downloads `.csv` |

### Upload
| Method | Path | Notes |
|---|---|---|
| POST | `/upload/image` | `multipart/form-data`, field name `image`. Returns `{ url }` |

---

## Key design decisions

**No ORM** — all queries use `@supabase/supabase-js` directly against Postgres.

**Atomic stock updates** — `consume_stock` and `receive_stock` are Postgres functions that lock the row, check quantity, update, and insert the log in one transaction. This prevents race conditions when two staff update the same item simultaneously.

**Zero quantity block** — consuming stock that would bring `current_qty` to 0 or below is rejected at the database function level with `INSUFFICIENT_STOCK`. The API returns a clear error message.

**Append-only logs** — `stock_logs` rows are never edited or deleted. Every update is permanent.

**Soft delete** — items are never physically deleted. `is_active = false` hides them from the UI while preserving all log history.

**Service role key** — the backend uses Supabase's service role key which bypasses Row Level Security. Never expose this key to the frontend.

---

## Build for production

```bash
npm run build   # compiles to dist/
npm start       # runs dist/index.js
```
