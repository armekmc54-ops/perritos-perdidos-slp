import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Perritos Perdidos SLP",
  description:
    "Plataforma comunitaria para reportar, rescatar y dar en adopción perritos en San Luis Potosí.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Perritos SLP",
  },
  icons: {
    icon: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
    apple: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
  },
};

export const viewport: Viewport = {
  themeColor: "#2C5F8A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased selection:bg-paliacate selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
