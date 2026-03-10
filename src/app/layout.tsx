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

/* build-version: 2026-03-10T07 — force chunk hash invalidation */
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
        <Script id="botpress-init" strategy="afterInteractive">
          {`
            (function initBotpress() {
              function start() {
                if (!window.botpress || typeof window.botpress.init !== 'function') {
                  return false;
                }

                if (window.__neoBotpressInitialized) {
                  return true;
                }

                window.botpress.init({
                  botId: '8cce7ded-3a93-4864-8d1d-9056fd550424',
                  clientId: 'ebbb9b25-3afa-4153-a0e3-84e5e0c3a389',
                  configuration: {
                    version: 'v2',
                    composerPlaceholder: 'Pose ta question',
                    botName: 'Agent de Support NeoTicket',
                    botAvatar: 'https://files.bpcontent.cloud/2026/03/10/03/20260310031152-5BHYAE77.png',
                    botDescription: 'Repond a toutes vos preoccupations en rapport avec NeoTicket.',
                    website: {},
                    email: {},
                    phone: {},
                    termsOfService: {},
                    privacyPolicy: {},
                    color: '#19bf75',
                    variant: 'solid',
                    headerVariant: 'solid',
                    themeMode: 'dark',
                    fontFamily: 'inter',
                    radius: 2.5,
                    feedbackEnabled: false,
                    footer: '[⚡ by Botpress](https://botpress.com/?from=webchat)',
                    soundEnabled: false,
                    proactiveMessageEnabled: false,
                    proactiveBubbleMessage: 'Hi! Need help?',
                    proactiveBubbleTriggerType: 'afterDelay',
                    proactiveBubbleDelayTime: 10,
                    conversationHistory: false,
                    showLauncher: false
                  }
                });

                function lockLauncherOff() {
                  if (!window.botpress || typeof window.botpress.config !== 'function') {
                    return;
                  }
                  window.botpress.config({
                    configuration: {
                      showLauncher: false
                    }
                  });
                }

                lockLauncherOff();

                if (typeof window.botpress.on === 'function') {
                  window.botpress.on('webchat:initialized', function() {
                    lockLauncherOff();
                  });
                  window.botpress.on('webchat:opened', function() {
                    lockLauncherOff();
                  });
                }

                // Some environments re-apply remote config after init; lock it again.
                var lockTries = 0;
                var lockTimer = setInterval(function() {
                  lockTries += 1;
                  lockLauncherOff();
                  if (lockTries > 20) {
                    clearInterval(lockTimer);
                  }
                }, 500);

                window.__neoBotpressInitialized = true;
                return true;
              }

              if (start()) {
                return;
              }

              var tries = 0;
              var timer = setInterval(function() {
                tries += 1;
                if (start() || tries > 60) {
                  clearInterval(timer);
                }
              }, 250);
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
          <BotpressLauncher />
          <PwaRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
