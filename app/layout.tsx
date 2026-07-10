import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: { default: "Surgify AI — Surgical skills training", template: "%s · Surgify AI" },
    description: "An immersive virtual patient environment for simulated clinical and surgical skills training.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Surgify AI",
      description: "Enter an immersive virtual patient simulation for guided wound-closure training.",
      images: [{ url: new URL("/og-simulation.png", metadataBase).toString(), width: 1200, height: 630, alt: "Surgify AI virtual patient simulation" }],
    },
    twitter: { card: "summary_large_image", title: "Surgify AI", description: "Immersive virtual patient training.", images: [new URL("/og-simulation.png", metadataBase).toString()] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
