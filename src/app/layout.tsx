import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { GlobalErrorAlerts } from "@/components/GlobalErrorAlerts";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlfaAltoGrup",
  description: "Gestão, agendamento e disparo em grupos de WhatsApp",
  manifest: "/manifest.json",
  applicationName: "AlfaAltoGrup",
  appleWebApp: {
    capable: true,
    title: "AlfaAltoGrup",
    // A barra do iOS acompanha o fundo do app em vez de virar uma faixa branca
    statusBarStyle: "black-translucent"
  },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  themeColor: "#0f1115",
  width: "device-width",
  initialScale: 1,
  // Sem isso as areas seguras (notch e barra de gestos) nao valem nada
  viewportFit: "cover"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>
          <GlobalErrorAlerts />
          {children}
        </Providers>
        <Script id="register-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function (e) {
                console.warn('Service worker nao registrado:', e && e.message);
              });
            });
          }`}
        </Script>
      </body>
    </html>
  );
}
