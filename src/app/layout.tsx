import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import KendoProvider from "@/components/kendo/KendoProvider";
import AuthInitializer from "@/components/auth/AuthInitializer";
import ToastContainer from "@/components/ui/ToastContainer";
import "./globals.scss";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4A90D9",
};

export const metadata: Metadata = {
  title: {
    default: "GrowUpMore Admin Portal",
    template: "%s | GrowUpMore Admin",
  },
  description: "Enterprise administration portal for GrowUpMore platform",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GrowUpMore Admin",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inter font from Google */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <KendoProvider>
            <AuthInitializer />
            <ToastContainer />
            {children}
          </KendoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
