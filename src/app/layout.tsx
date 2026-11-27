import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { AnalyticsDashboardProvider } from "@/context/AnalyticsDashboardContext";
import { DemoSessionProvider } from "@/context/DemoSessionContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comer Fora",
  description:
    "Converter delivery em visita ao salão com diagnóstico mensurável. Projeto de candidato - dados sintéticos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        {/* next/font/google falha no build Vercel - CSS externo no <head> */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- next/font/google quebra no build Vercel */}
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap"
          rel="stylesheet"
          precedence="default"
        />
      </head>
      <body className="font-body antialiased">
        <DemoSessionProvider>
          <AnalyticsDashboardProvider>
            <AppShell>{children}</AppShell>
          </AnalyticsDashboardProvider>
        </DemoSessionProvider>
      </body>
    </html>
  );
}
