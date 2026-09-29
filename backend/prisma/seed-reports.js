const { PrismaClient, Species, ReportType, Status } = require('@prisma/client');
const prisma = new PrismaClient();

const sampleReports = [
  {
    petName: 'Rocky',
    title: 'Perrito mestizo café con collar rojo',
    description: 'Se extravió cerca de la glorieta de Morales en Parque Tangamanga I. Es muy juguetón y dócil. Responde al nombre de Rocky.',
    type: ReportType.LOST,
    species: Species.DOG,
    breed: 'Mestizo',
    primaryColor: 'Café claro',
    size: 'MEDIANO',
    latitude: 22.1485,
    longitude: -100.9985,
    contactPhone: '4448123456',
    reward: 1500,
    status: Status.ACTIVE,
    mediaUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&auto=format&fit=crop',
    userEmail: 'mariana.rescatista@slp.com',
  },
  {
    petName: 'Michi',
    title: 'Gato siamés ojos azules extraviado',
    description: 'Gatito de 2 años escapó por la azotea en Lomas 4ta Sección. Es asustadizo con ruidos fuertes, podría estar escondido en cocheras.',
    type: ReportType.LOST,
    species: Species.CAT,
    breed: 'Siamés',
    primaryColor: 'Blanco y crema',
    size: 'CHICO',
    latitude: 22.1380,
    longitude: -101.0250,
    contactPhone: '4445567890',
    reward: 800,
    status: Status.ACTIVE,
    mediaUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop',
    userEmail: 'carlos.vet@slp.com',
  },
  {
    petName: 'Luna',
    title: 'Cachorra mestiza busca hogar responsable',
    description: 'Rescatada de las vías en Soledad de Graciano Sánchez. Desparasitada, vacunada y súper cariñosa con niños y otros perros.',
    type: ReportType.ADOPTION,
    species: Species.DOG,
    breed: 'Cruza de Labrador',
    primaryColor: 'Negro con blanco',
    size: 'MEDIANO',
    latitude: 22.1800,
    longitude: -100.9400,
    contactPhone: '4441122334',
    status: Status.ACTIVE,
    mediaUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&auto=format&fit=crop',
    userEmail: 'ana.comunidad@slp.com',
  },
  {
    title: 'Avistamiento de perro café trotando hacia el río',
    description: 'Vi a un perrito parecido a Rocky cruzando Boulevard Río Santiago a paso rápido con dirección a Carretera Matehuala.',
    type: ReportType.SIGHTING,
    species: Species.DOG,
    breed: 'Mestizo café',
    primaryColor: 'Café',
    size: 'MEDIANO',
    latitude: 22.1620,
    longitude: -100.9780,
    contactPhone: '4441122334',
    status: Status.ACTIVE,
    mediaUrl: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=800&auto=format&fit=crop',
    userEmail: 'ana.comunidad@slp.com',
  },
];

async function main() {
  console.log('--- Sembrando reportes iniciales en Supabase ---');
  for (const rep of sampleReports) {
    const user = await prisma.user.findUnique({ where: { email: rep.userEmail } });
    if (!user) continue;

    await prisma.report.create({
      data: {
        petName: rep.petName || null,
        title: rep.title,
        description: rep.description,
        type: rep.type,
        species: rep.species,
        breed: rep.breed,
        primaryColor: rep.primaryColor,
        size: rep.size,
        latitude: rep.latitude,
        longitude: rep.longitude,
        contactPhone: rep.contactPhone,
        reward: rep.reward || null,
        status: rep.status,
        mediaUrl: rep.mediaUrl,
        userId: user.id,
      },
    });
    console.log(`Reporte creado: ${rep.title} (${rep.species})`);
  }
  console.log('--- Reportes sembrados con éxito ---');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
