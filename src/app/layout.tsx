import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart CSV Cleaner",
  description: "Inspect CSV issues, choose safe fixes, and download a cleaned file. All processing stays in your browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
