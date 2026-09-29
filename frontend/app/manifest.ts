import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Perritos Perdidos SLP',
    short_name: 'Perritos SLP',
    description: 'Plataforma comunitaria para reportar, rescatar y dar en adopción perritos en San Luis Potosí.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5EFE6',
    theme_color: '#2C5F8A',
    icons: [
      {
        src: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://cdn-icons-png.flaticon.com/512/616/616408.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
