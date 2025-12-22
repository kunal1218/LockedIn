import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { BackgroundDecor } from "@/components/BackgroundDecor";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthModal, AuthProvider } from "@/features/auth";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LockedIn",
  description:
    "Meet new friends, collaborators, and cofounders. Campus energy, no dating vibes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-sans antialiased`}>
        <AuthProvider>
          <div className="relative min-h-screen overflow-hidden">
            <BackgroundDecor />
            <SiteHeader />
            <main className="relative z-10">{children}</main>
          </div>
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  );
}
