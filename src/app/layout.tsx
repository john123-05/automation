import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { InboxAutoSync } from "@/components/inbox-auto-sync";
import { getEnv } from "@/lib/env";
import { getUiSettings } from "@/lib/ui-settings";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Fieldflow",
  description:
    "A sales outreach machine that replaces n8n lead scraping and enrichment flows with a real dashboard.",
};

const rootClassName = `${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`;

const bodyClassName =
  "min-h-full bg-background text-foreground selection:bg-cyan-200 selection:text-slate-950";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { language, theme } = await getUiSettings();
  const env = getEnv();

  return (
    <html lang={language} className={`${rootClassName} ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <body className={bodyClassName}>
        <InboxAutoSync
          enabled={env.inboxAutoSyncEnabled}
          intervalSeconds={env.inboxPollIntervalSeconds}
        />
        {children}
      </body>
    </html>
  );
}
