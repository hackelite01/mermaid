# Mermaid Studio

A production-ready, full-stack Mermaid diagram editor built with Next.js (App Router), TypeScript, MongoDB, and NextAuth.

## Features

- **Authentication** — Credentials (email/password, bcrypt + JWT) and optional Google OAuth via NextAuth.
- **Dashboard** — List, search, rename, delete diagrams with relative timestamps.
- **Editor** — Monaco code editor, live Mermaid preview with 300ms debounced rendering, syntax error display, fullscreen toggle, theme + custom color controls (primary, background, font), per-diagram persistence, auto-save (1s debounce), `Ctrl/Cmd+S` save shortcut.
- **Export** — Download diagrams as SVG or PNG.
- **Themed UI** — Tailwind + shadcn-style primitives, dark mode via `next-themes`, toast notifications, loading skeletons, responsive layout.
- **Hardened API** — Zod validation on all inputs, ownership checks on every diagram route, sanitized SVG output (DOMPurify), strict Mermaid `securityLevel`.

## Tech Stack

- Next.js 14 (App Router), TypeScript, React 18
- TailwindCSS + Radix primitives (shadcn-style)
- Monaco Editor (`@monaco-editor/react`, dynamically imported)
- Mermaid 11 (lazy-loaded)
- MongoDB + Mongoose
- NextAuth.js (JWT sessions)
- Zustand for editor state
- Zod for validation

## Project Structure

```
app/
  api/
    auth/[...nextauth]/route.ts   NextAuth handler
    auth/signup/route.ts          Credentials signup
    diagrams/route.ts             List + create
    diagrams/[id]/route.ts        Get, update, delete
  auth/login/page.tsx
  auth/signup/page.tsx
  dashboard/layout.tsx            Auth-guarded layout (sidebar)
  dashboard/page.tsx              Diagram dashboard
  editor/[id]/page.tsx            Editor page (server-loaded)
  layout.tsx                      Root layout, providers, toaster
  page.tsx                        Marketing/landing
components/
  ui/*                            shadcn-style primitives
  dashboard/*                     Sidebar, list, dialogs
  editor/*                        Monaco wrapper, Mermaid preview, style panel, shell
  theme-provider.tsx, theme-toggle.tsx
lib/
  db.ts                           Cached Mongoose connection
  auth.ts                         NextAuth options
  validators.ts                   Zod schemas
  utils.ts                        cn, debounce, formatRelative
models/
  User.ts, Diagram.ts
store/diagram-store.ts            Zustand editor store
types/next-auth.d.ts              Module augmentation
middleware.ts                     Protects /dashboard and /editor
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in:

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mermaid
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Optional Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 3. MongoDB setup

- Use **MongoDB Atlas** (recommended for Vercel — serverless-friendly).
- Create a cluster, add a database user, allow `0.0.0.0/0` (or Vercel IPs).
- The driver connection in `lib/db.ts` caches the connection across hot reloads and serverless invocations.

### 4. Run dev server

```bash
npm run dev
```

Visit `http://localhost:3000`.

## API

All routes return JSON. Diagram routes require an authenticated NextAuth session.

| Method | Path                  | Body                                       | Description           |
| ------ | --------------------- | ------------------------------------------ | --------------------- |
| POST   | `/api/auth/signup`    | `{email,password,name?}`                   | Create account        |
| POST   | `/api/auth/callback/credentials` | (handled by NextAuth)            | Sign in               |
| GET    | `/api/diagrams?q=...` | —                                          | List user's diagrams  |
| POST   | `/api/diagrams`       | `{title?,code?,theme?,customStyles?}`      | Create new diagram    |
| GET    | `/api/diagrams/:id`   | —                                          | Fetch one             |
| PUT    | `/api/diagrams/:id`   | partial diagram                            | Update                |
| DELETE | `/api/diagrams/:id`   | —                                          | Delete                |

## Deployment (Vercel)

1. Push the repo to GitHub.
2. Import into Vercel.
3. Set environment variables in **Project Settings → Environment Variables**:
   - `MONGODB_URI`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` — your production URL (e.g. `https://your-app.vercel.app`)
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional)
4. Deploy. The Mongoose connection in `lib/db.ts` is cached on the global object, so it reuses the connection across warm Lambda invocations.

## Security Notes

- Mermaid is initialized with `securityLevel: "strict"`; rendered SVG is also passed through DOMPurify before injection.
- All POST/PUT bodies are validated with Zod.
- All diagram routes enforce `userId` ownership.
- Passwords hashed with bcrypt (cost 12).
- `NEXTAUTH_SECRET` is required in production.

## Scripts

```
npm run dev        # Start dev server
npm run build      # Production build
npm start          # Run production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

## License

MIT
