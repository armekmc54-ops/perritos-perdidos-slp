import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';

export const ADMIN_PIN = '230408';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_salt_slp_2026').digest('hex');
}

export interface SyncUserDto {
  email: string;
  name?: string;
  avatarUrl?: string;
  phone?: string;
  role?: Role;
  adminCode?: string;
}

export interface RegisterUserDto {
  email: string;
  name: string;
  phone: string;
  password: string;
}

export interface VerifyCredentialsDto {
  email: string;
  password: string;
}

export interface RequestResetCodeDto {
  email: string;
  phone: string;
}

export interface ResetPasswordDto {
  email: string;
  phone: string;
  code: string;
  newPassword: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  private resetCodes = new Map<string, { code: string; expiresAt: number; phone: string }>();

  constructor(private prisma: PrismaService) {}

  // Sincronizar o crear usuario al iniciar sesión (NextAuth)
  async syncUser(data: SyncUserDto) {
    const normalizedEmail = (data.email || '').toLowerCase().trim();
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Solo se otorga rol de ADMIN si se proporciona el código de seguridad 230408 o si es armekmc54@gmail.com
    const isSuperAdmin = normalizedEmail === 'armekmc54@gmail.com';
    const requestedAdmin = data.adminCode === ADMIN_PIN || isSuperAdmin;
    const finalRole = requestedAdmin ? Role.ADMIN : Role.USER;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          name: data.name || (isSuperAdmin ? 'Armando (Administrador M&A)' : 'Miembro SLP'),
          avatarUrl: data.avatarUrl || null,
          phone: data.phone || (isSuperAdmin ? '4443211123' : null),
          role: finalRole,
          level: isSuperAdmin ? 'Administrador M&A 👑' : 'Rescatista Novato',
          points: isSuperAdmin ? 1000 : 0,
        },
      });
    } else {
      const updateData: any = {
        name: data.name || user.name,
        avatarUrl: data.avatarUrl || user.avatarUrl,
        phone: data.phone || user.phone,
      };

      // Si proporciona el código correcto o es el correo del administrador, elevar a ADMIN
      if (data.adminCode === ADMIN_PIN || isSuperAdmin) {
        updateData.role = Role.ADMIN;
        if (isSuperAdmin) {
          updateData.level = 'Administrador M&A 👑';
        }
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

  // Registro de nuevo usuario comunitario con validación estricta anti-duplicados
  async register(data: RegisterUserDto) {
    const normalizedEmail = (data.email || '').toLowerCase().trim();
    const cleanPhone = (data.phone || '').replace(/\D/g, '');

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new BadRequestException('Ingresa un correo electrónico válido.');
    }

    if (!data.name || data.name.trim().length < 2) {
      throw new BadRequestException('Ingresa tu nombre completo.');
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      throw new BadRequestException('Ingresa un número de teléfono válido a 10 dígitos.');
    }

    if (!data.password || data.password.length < 4) {
      throw new BadRequestException('La contraseña debe tener al menos 4 caracteres.');
    }

    // 1. Validar si el correo ya existe
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUserByEmail) {
      throw new BadRequestException(
        'Este correo electrónico ya está registrado. Por favor inicia sesión o recupera tu contraseña si la olvidaste.'
      );
    }

    // 2. Validar si el teléfono ya existe en otra cuenta
    const allUsers = await this.prisma.user.findMany({
      select: { id: true, phone: true },
    });
    const duplicatePhoneUser = allUsers.find(
      (u) => u.phone && u.phone.replace(/\D/g, '') === cleanPhone
    );
    if (duplicatePhoneUser) {
      throw new BadRequestException(
        'Este número de teléfono ya está asociado a otra cuenta registrada. Usa otro teléfono o inicia sesión.'
      );
    }

    // 3. Crear el usuario con contraseña cifrada
    const isSuperAdmin = normalizedEmail === 'armekmc54@gmail.com';
    return this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: data.name.trim(),
        phone: data.phone.trim(),
        passwordHash: hashPassword(data.password),
        role: isSuperAdmin ? Role.ADMIN : Role.USER,
        level: isSuperAdmin ? 'Administrador M&A 👑' : 'Rescatista Novato',
        points: isSuperAdmin ? 1000 : 0,
      },
    });
  }

  // Verificación de credenciales en inicio de sesión
  async verifyCredentials(data: VerifyCredentialsDto) {
    const normalizedEmail = (data.email || '').toLowerCase().trim();

    // Cuenta de administración maestra
    if (normalizedEmail === 'armekmc54@gmail.com') {
      if (data.password !== 'TeAmoXimena230408@') {
        throw new UnauthorizedException('Contraseña de Administrador incorrecta.');
      }
      return this.syncUser({
        email: normalizedEmail,
        name: 'Armando (Administrador M&A)',
        phone: '4443211123',
        adminCode: '230408',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('No existe ninguna cuenta registrada con este correo electrónico.');
    }

    if (user.passwordHash) {
      const inputHash = hashPassword(data.password);
      if (user.passwordHash !== inputHash) {
        throw new UnauthorizedException('Contraseña incorrecta. Verifica tus datos o recupera tu contraseña.');
      }
    } else {
      // Si la cuenta no tenía contraseña guardada previamente, la establecemos con la ingresada
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(data.password) },
      });
    }

    return user;
  }

  // Solicitar código de verificación de 6 dígitos para restablecer contraseña
  async requestResetCode(data: RequestResetCodeDto) {
    const normalizedEmail = (data.email || '').toLowerCase().trim();
    const cleanPhone = (data.phone || '').replace(/\D/g, '');

    // BLINDAJE ABSOLUTO: El Super Admin no puede ser reseteado desde interfaz pública
    if (normalizedEmail === 'armekmc54@gmail.com') {
      throw new ForbiddenException('Por seguridad institucional, la cuenta de Administrador Maestro está blindada contra modificaciones externas.');
    }

    if (!normalizedEmail || !cleanPhone) {
      throw new BadRequestException('El correo y el teléfono registrado son obligatorios para solicitar el código de seguridad.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new NotFoundException('No se encontró ninguna cuenta registrada con este correo electrónico.');
    }

    const userCleanPhone = (user.phone || '').replace(/\D/g, '');
    if (!userCleanPhone || userCleanPhone !== cleanPhone) {
      throw new BadRequestException(
        'El número de teléfono no coincide con el registrado en esta cuenta. Por seguridad, no se puede generar el código.'
      );
    }

    // Generar código numérico seguro de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutos de vigencia

    this.resetCodes.set(normalizedEmail, { code, expiresAt, phone: cleanPhone });
    console.log(`[SEGURIDAD] Código de verificación para ${normalizedEmail}: ${code}`);

    return {
      success: true,
      message: 'Código de verificación de 6 dígitos generado exitosamente.',
      code, // Para verificación ágil y soporte
    };
  }

  // Recuperación / restablecimiento de contraseña mediante código OTP + teléfono + correo
  async resetPassword(data: ResetPasswordDto) {
    const normalizedEmail = (data.email || '').toLowerCase().trim();
    const cleanPhone = (data.phone || '').replace(/\D/g, '');

    // BLINDAJE ABSOLUTO: El Super Admin no puede ser reseteado
    if (normalizedEmail === 'armekmc54@gmail.com') {
      throw new ForbiddenException('Por seguridad institucional, la cuenta de Administrador Maestro está blindada contra modificaciones externas.');
    }

    if (!normalizedEmail || !cleanPhone) {
      throw new BadRequestException('El correo y el teléfono son obligatorios para validar tu identidad.');
    }

    if (!data.code || data.code.trim().length !== 6) {
      throw new BadRequestException('Por favor ingresa el código de verificación de 6 dígitos.');
    }

    if (!data.newPassword || data.newPassword.length < 4) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 4 caracteres.');
    }

    // Validar el código de seguridad
    const stored = this.resetCodes.get(normalizedEmail);
    if (!stored || Date.now() > stored.expiresAt) {
      throw new BadRequestException('El código de verificación ha expirado o no ha sido solicitado. Por favor solicita uno nuevo.');
    }

    if (stored.code !== data.code.trim()) {
      throw new BadRequestException('El código de verificación de 6 dígitos es incorrecto.');
    }

    if (stored.phone !== cleanPhone) {
      throw new BadRequestException('El número de teléfono no coincide con la solicitud.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new NotFoundException('No se encontró ninguna cuenta registrada con este correo electrónico.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(data.newPassword) },
    });

    // Invalida el código de un solo uso
    this.resetCodes.delete(normalizedEmail);

    return {
      success: true,
      message: '¡Contraseña actualizada exitosamente! Ya puedes iniciar sesión con tu nueva contraseña.',
    };
  }
}
