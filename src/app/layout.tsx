import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "@/components/auth/auth-provider";
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
        {/* Push Botpress FAB above fixed navbar on all devices */}
        <Script id="botpress-position-fix" strategy="afterInteractive">
          {`
            (function() {
              var FAB_BOTTOM = 72;
              var applied = false;

              function applyToEl(el) {
                if (!el || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
                el.style.setProperty('bottom', FAB_BOTTOM + 'px', 'important');
                el.style.setProperty('z-index', '9999', 'important');
                el.style.setProperty('visibility', 'visible', 'important');
                el.style.setProperty('opacity', '1', 'important');
                applied = true;
              }

              function tryFix() {
                // Known Botpress v3 container IDs / element names
                var candidates = [
                  document.getElementById('bp-web-widget'),
                  document.getElementById('bp-webchat'),
                  document.getElementById('botpress-webchat'),
                  document.getElementById('bp-web-widget-container'),
                  document.querySelector('bp-webchat'),
                  document.querySelector('[class*="bpWidget"]'),
                  document.querySelector('[class*="bpFab"]'),
                  document.querySelector('[class*="FabButton"]'),
                  document.querySelector('[class*="fabButton"]'),
                ];
                candidates.forEach(function(el) {
                  if (el) applyToEl(el);
                });
              }

              // Poll until found (Botpress loads asynchronously)
              var attempts = 0;
              var timer = setInterval(function() {
                tryFix();
                if (applied || ++attempts >= 30) clearInterval(timer);
              }, 500);

              // Also use MutationObserver in case Botpress is added later
              var observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(m) {
                  m.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    var id = (node.id || '').toLowerCase();
                    var tag = (node.tagName || '').toLowerCase();
                    if (id.includes('bp') || id.includes('botpress') || tag === 'bp-webchat') {
                      applyToEl(node);
                    }
                  });
                });
              });
              observer.observe(document.body, { childList: true });

              // Hook into Botpress ready event if available
              var bpCheck = setInterval(function() {
                if (window.botpress && typeof window.botpress.on === 'function') {
                  clearInterval(bpCheck);
                  window.botpress.on('webchat:ready', tryFix);
                  window.botpress.on('ready', tryFix);
                }
              }, 300);
              setTimeout(function() { clearInterval(bpCheck); }, 15000);
            })();
          `}
        </Script>
      </head>
      <body
        className={`${poppins.variable} ${geistMono.variable} antialiased pb-20`}
      >
        <AuthProvider>
          {children}
          <GlobalPlatformNav />
          <PwaRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
