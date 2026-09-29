import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

export const ADMIN_PIN = '230408';

export interface SyncUserDto {
  email: string;
  name?: string;
  avatarUrl?: string;
  phone?: string;
  role?: Role;
  adminCode?: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Sincronizar o crear usuario al iniciar sesión (NextAuth)
  async syncUser(data: SyncUserDto) {
    const normalizedEmail = (data.email || '').toLowerCase().trim();
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Solo se otorga rol de ADMIN si se proporciona el código de seguridad 230408
    const requestedAdmin = data.adminCode === ADMIN_PIN;
    const finalRole = requestedAdmin ? Role.ADMIN : Role.USER;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          name: data.name || 'Miembro SLP',
          avatarUrl: data.avatarUrl || null,
          phone: data.phone || null,
          role: finalRole,
        },
      });
    } else {
      const updateData: any = {
        name: data.name || user.name,
        avatarUrl: data.avatarUrl || user.avatarUrl,
        phone: data.phone || user.phone,
      };

      // Si proporciona el código correcto, elevar a ADMIN
      if (data.adminCode === ADMIN_PIN) {
        updateData.role = Role.ADMIN;
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    return user;
  }

  // Obtener perfil completo por correo electrónico
  async getProfile(email: string) {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
        },
        pointTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        foundReports: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con email ${email} no encontrado`);
    }

    return user;
  }

  // Actualizar datos del perfil (nombre, teléfono público, foto)
  async updateProfile(email: string, data: UpdateProfileDto) {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new NotFoundException(`Usuario con email ${email} no encontrado`);
    }

    return this.prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        name: data.name !== undefined ? data.name : user.name,
        phone: data.phone !== undefined ? data.phone : user.phone,
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : user.avatarUrl,
      },
    });
  }

  // Asignar rol de Administrador protegiéndolo con el código 230408
  async makeAdmin(email: string, adminCode: string) {
    if (adminCode !== ADMIN_PIN) {
      throw new UnauthorizedException('Código de administrador incorrecto. Acceso denegado.');
    }

    const normalizedEmail = (email || '').toLowerCase().trim();
    return this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { role: Role.ADMIN },
    });
  }
}
