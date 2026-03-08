import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meteora PnL Card Generator",
  description: "Generate shareable realized PnL cards from Meteora DLMM close-position transactions."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
