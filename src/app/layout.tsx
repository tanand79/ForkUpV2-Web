import type { Metadata } from "next";
import Script from "next/script";
import { DM_Serif_Display, Inter, Playfair_Display } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "ForkUp — Turn everyday spending into real community impact",
  description: "ForkUp helps nonprofits and local businesses create fundraising campaigns.",
  icons: {
    icon: "/assets/forkup-logo-header.png",
    apple: "/assets/forkup-logo-header.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} ${dmSerif.variable} antialiased`}>
        {/* Production only — Next.js injects beforeInteractive scripts into document head */}
        {process.env.NODE_ENV === "production" ? (
          <Script src="/runtime-config.js" strategy="beforeInteractive" />
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
