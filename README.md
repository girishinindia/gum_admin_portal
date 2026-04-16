# Grow Up More — Admin Portal

Professional Next.js 15 admin portal for the GrowUpMore API. Light blue theme, TypeScript, Tailwind CSS.

## Features

- **Authentication**: Login, dual-OTP registration, forgot-password flow (email + mobile verification)
- **Dashboard**: Platform stats, recent activity
- **Users**: List, search, filter, detail view, role assignment, session management, suspend/reactivate
- **Roles**: CRUD + dynamic permission assignment with bulk updates
- **Permissions**: Grouped by resource, toggle active/inactive
- **Countries**: CRUD with flag image upload (auto-converted to WebP via API)
- **Activity Logs**: 4 log types (auth, admin, data, system) with filters, pagination, change tracking

## Stack

- **Next.js 15** (App Router, Turbopack)
- **React 19**, TypeScript
- **Tailwind CSS 3** (custom sky-blue theme)
- **React Hook Form + Zod** for validation
- **Sonner** for toast notifications
- **Lucide React** icons
- **Day.js** for date formatting

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure API URL
cp .env.example .env.local
# Edit NEXT_PUBLIC_API_URL to point to your running growupmore-api

# 3. Start dev server
npm run dev
```

Opens at `http://localhost:3000`.

## Project Structure

```
growupmore-admin/
├── app/
│   ├── (auth)/           # Login, register, forgot-password (public)
│   └── (admin)/          # Protected admin area
│       ├── dashboard/
│       ├── users/
│       ├── roles/
│       ├── permissions/
│       ├── countries/
│       └── activity-logs/
├── components/
│   ├── ui/               # Button, Input, Card, Dialog, Table, etc.
│   └── layout/           # Sidebar, PageHeader
├── hooks/
│   └── useAuth.tsx       # Auth context + token management
├── lib/
│   ├── api.ts            # API client with auto-refresh
│   ├── types.ts          # TypeScript interfaces
│   └── utils.ts          # cn(), formatDate(), etc.
└── tailwind.config.ts    # Light blue theme
```

## Authentication Flow

**Registration** (4 steps):
1. User fills form → API sends OTP to both email + mobile
2. User verifies email OTP
3. User verifies mobile OTP → account created, auto-logged in

**Forgot Password** (3 steps):
1. User enters email + mobile → both must match same account → OTP sent to both
2. User verifies BOTH OTPs (in any order)
3. User sets new password → all sessions revoked → login required

**Token Management**:
- Access token (15 min) stored in localStorage
- Refresh token (7 days) auto-rotates on 401
- Automatic logout on refresh failure

## Design System

**Colors**: Sky-blue palette (`brand.50` → `brand.950`)
**Typography**: Plus Jakarta Sans (display + body), JetBrains Mono (code)
**Shadows**: Custom `shadow-card`, `shadow-card-hover`, `shadow-brand`

## Theming

Edit `tailwind.config.ts` → `colors.brand` to customize the primary palette.
All components use `brand-*` utility classes.
