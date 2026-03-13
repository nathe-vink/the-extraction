import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE EXTRACTION",
  description:
    "An alien has come to destroy Earth. It will take one of you. Convince it you're worthy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="starfield" />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
