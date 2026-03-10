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

/* build-version: 2026-03-10T06 — force chunk hash invalidation */
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
                  showLauncher: false,
                  hideWidget: false,
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
                    showLauncher: false,
                    hideWidget: false
                  }
                });

                // Compatibility path: some runtimes expose botpressWebChat API.
                if (window.botpressWebChat && typeof window.botpressWebChat.init === 'function') {
                  window.botpressWebChat.init({
                    botId: '8cce7ded-3a93-4864-8d1d-9056fd550424',
                    clientId: 'ebbb9b25-3afa-4153-a0e3-84e5e0c3a389',
                    showLauncher: false,
                    hideWidget: false
                  });
                }

                function lockNativeLauncherOff() {
                  if (!window.botpress || typeof window.botpress.config !== 'function') {
                    return;
                  }

                  // Keep both shapes for compatibility with Botpress runtime variants.
                  window.botpress.config({ showLauncher: false });
                  window.botpress.config({
                    configuration: {
                      showLauncher: false,
                    },
                  });

                  // Nuclear option: send hide event if available
                  if (typeof window.botpress.sendEvent === 'function') {
                    window.botpress.sendEvent({ type: 'hide' });
                  }

                  // Try to inject CSS into chat iframe if it exists
                  try {
                    var iframes = document.querySelectorAll('iframe[name="bp-webchat"], iframe[src*="botpress"]');
                    iframes.forEach(function(iframe) {
                      if (iframe.contentDocument) {
                        var style = iframe.contentDocument.createElement('style');
                        style.innerHTML = '.bpw-launcher { display: none !important; } .bpFabWrapper { display: none !important; }';
                        iframe.contentDocument.head.appendChild(style);
                      }
                    });
                  } catch (e) {
                    // If cross-origin, this will fail - that's expected
                  }
                }

                function forceNativeWidgetBottom() {
                  // Target ALL iframes on the page
                  var iframes = document.querySelectorAll('iframe');
                  iframes.forEach(function(iframe) {
                    if (iframe.src && (iframe.src.includes('botpress') || iframe.id.includes('bp-'))) {
                      iframe.style.setProperty('bottom', '110px', 'important');
                      iframe.style.setProperty('right', '12px', 'important');
                      iframe.style.setProperty('z-index', '60', 'important');
                      iframe.style.setProperty('transform', 'translateY(-20px)', 'important');
                    }
                  });

                  // Target shadow-root potential containers
                  var botpressHost = document.querySelector('#bp-webchat-container');
                  if (botpressHost) {
                    botpressHost.style.setProperty('bottom', '110px', 'important');
                    botpressHost.style.setProperty('right', '12px', 'important');
                    botpressHost.style.setProperty('z-index', '60', 'important');
                    botpressHost.style.setProperty('transform', 'translateY(-20px)', 'important');
                  }

                  // Also target all divs that start with 'bp-'
                  var allBpDivs = document.querySelectorAll('[class*="bp-"], [id*="bp-"]');
                  allBpDivs.forEach(function(el) {
                    if (el.style && el.parentNode && el.parentNode.nodeName !== 'IFRAME') {
                      el.style.setProperty('bottom', '110px', 'important');
                      el.style.setProperty('z-index', '60', 'important');
                    }
                  });
                }

                lockNativeLauncherOff();
                forceNativeWidgetBottom();

                if (typeof window.botpress.on === 'function') {
                  window.botpress.on('webchat:initialized', lockNativeLauncherOff);
                  window.botpress.on('webchat:initialized', forceNativeWidgetBottom);
                  window.botpress.on('webchat:ready', function() {
                    lockNativeLauncherOff();
                    forceNativeWidgetBottom();
                    // On ready, immediately hide the launcher with event
                    if (typeof window.botpress.sendEvent === 'function') {
                      window.botpress.sendEvent({ type: 'hide' });
                    }
                  });
                  window.botpress.on('webchat:opened', lockNativeLauncherOff);
                  window.botpress.on('webchat:opened', forceNativeWidgetBottom);
                }

                var lockTries = 0;
                var lockTimer = setInterval(function() {
                  lockTries += 1;
                  lockNativeLauncherOff();
                  forceNativeWidgetBottom();
                  if (lockTries > 40) {
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
