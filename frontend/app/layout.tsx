import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Perritos o Animales Perdidos",
  description:
    "Plataforma comunitaria para reportar, rescatar y dar en adopción perritos y animales domésticos en San Luis Potosí.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Animales Perdidos",
  },
  icons: {
    icon: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
    apple: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
  },
  openGraph: {
    title: "Perritos o Animales Perdidos - San Luis Potosí",
    description: "Plataforma comunitaria para reportar, rescatar y encontrar mascotas perdidas en San Luis Potosí.",
    url: "https://frontend-three-murex-64.vercel.app",
    siteName: "Perritos o Animales Perdidos",
    images: [
      {
        url: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1200&auto=format&fit=crop&q=80",
        width: 1200,
        height: 630,
        alt: "Perritos o Animales Perdidos SLP",
      },
    ],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Perritos o Animales Perdidos - San Luis Potosí",
    description: "Plataforma comunitaria para reportar, rescatar y encontrar mascotas perdidas en San Luis Potosí.",
    images: ["https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1200&auto=format&fit=crop&q=80"],
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
