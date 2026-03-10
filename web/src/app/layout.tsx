import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { GlobalPlatformNav } from "@/components/app/global-platform-nav";
import { Poppins, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NeoTicket",
  description:
    "Ne ratez plus aucun événement au Burkina ! Concerts, festivals et soirées. Achetez vos tickets sur NeoTicket via Orange Money et recevez-les sur WhatsApp.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
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
