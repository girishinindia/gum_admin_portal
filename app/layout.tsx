import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Grow Up More — Admin',
  description: 'Admin portal for Grow Up More e-learning platform',
};

// The admin portal is a private, auth-gated dashboard with no SEO needs, and many
// pages use useSearchParams. Force dynamic rendering app-wide so the production
// build never statically prerenders them (which fails with "useSearchParams()
// should be wrapped in a suspense boundary"). Mirrors the gum_web (app) group.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
