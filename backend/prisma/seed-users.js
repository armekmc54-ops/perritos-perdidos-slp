const { PrismaClient, Role } = require('@prisma/client');
const prisma = new PrismaClient();

const testUsers = [
  {
    email: 'mariana.rescatista@slp.com',
    name: 'Mariana López (Rescatista Tangamanga)',
    phone: '4448123456',
    passwordHash: 'perritos123',
    role: Role.USER,
  },
  {
    email: 'carlos.vet@slp.com',
    name: 'Dr. Carlos Méndez (Veterinaria Lomas)',
    phone: '4445567890',
    passwordHash: 'perritos123',
    role: Role.USER,
  },
  {
    email: 'ana.comunidad@slp.com',
    name: 'Ana Lucía Torres (Vecina Pozos)',
    phone: '4441122334',
    passwordHash: 'perritos123',
    role: Role.USER,
  },
  {
    email: 'admin@slp.com',
    name: 'Administrador General',
    phone: '4443211123',
    passwordHash: 'perritos123',
    role: Role.ADMIN,
  },
];

async function main() {
  console.log('--- Sembrando usuarios de prueba en PostgreSQL ---');
  for (const u of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        phone: u.phone,
        passwordHash: u.passwordHash,
        role: u.role,
      },
      create: u,
    });
    console.log(`Usuario listo: ${user.email} (${user.name}) - Rol: ${user.role}`);
  }
  console.log('--- Sembrado completado con éxito ---');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
