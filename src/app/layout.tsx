import type { Metadata } from "next";
import { Nunito, Nunito_Sans } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AnalyticsDashboardProvider } from "@/context/AnalyticsDashboardContext";
import { DemoSessionProvider } from "@/context/DemoSessionContext";
import "./globals.css";

const title = Nunito({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-title",
});

const body = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Comer Fora · Pra Hoje",
  description:
    "Converter delivery em visita ao salão com diagnóstico mensurável. Projeto de candidato — dados sintéticos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${title.variable} ${body.variable} font-body antialiased`}>
        <DemoSessionProvider>
          <AnalyticsDashboardProvider>
            <AppShell>{children}</AppShell>
          </AnalyticsDashboardProvider>
        </DemoSessionProvider>
      </body>
    </html>
  );
}
