import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { LoyaltyProvider } from "@/hooks/use-loyalty";
import { loyaltyConfig } from "@/config/loyalty";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${loyaltyConfig.programName} | Loyalty Points Tracker`,
  description:
    "Manage customer loyalty points, track purchases, and let customers check their rewards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <LoyaltyProvider>{children}</LoyaltyProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
