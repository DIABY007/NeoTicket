import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "@/components/auth/auth-provider";
import { BotpressLauncher } from "@/components/botpress-launcher";
import { GlobalPlatformNav } from "@/components/app/global-platform-nav";
import { Poppins, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://neoticket.live";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NeoTicket — Billetterie en ligne au Burkina Faso",
    template: "%s | NeoTicket",
  },
  description:
    "Billetterie en ligne au Burkina Faso. Paiement sécurisé Orange Money et QR Code sur WhatsApp.",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    siteName: "NeoTicket",
    locale: "fr_BF",
    type: "website",
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

/* build-version: 2026-03-10T04 — force chunk hash invalidation */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-WY9D4NBWCG"
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-WY9D4NBWCG');
          `}
        </Script>
        <Script
          src="https://cdn.botpress.cloud/webchat/v3.6/inject.js"
          strategy="afterInteractive"
        />
        <Script
          src="https://files.bpcontent.cloud/2026/03/10/03/20260310031010-SG3OZF6G.js"
          strategy="afterInteractive"
        />
      </head>
      <body
        className={`${poppins.variable} ${geistMono.variable} antialiased pb-20`}
      >
        <AuthProvider>
          {children}
          <GlobalPlatformNav />
          <BotpressLauncher />
          <PwaRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
