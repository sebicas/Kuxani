import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kuxani — Harmonize Your Perspectives, Heal Together",
  description:
    "A collaborative AI-mediated platform where couples work together to understand each other's perspectives, resolve conflicts constructively, and build a stronger relationship.",
  keywords: [
    "couples therapy",
    "relationship",
    "AI therapist",
    "conflict resolution",
    "communication",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
