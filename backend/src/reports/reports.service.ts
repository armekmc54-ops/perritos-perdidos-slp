import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto, ResolveReportDto } from './dto/create-report.dto';
import { ReportType, Status, Role, Species } from '@prisma/client';
import { TriangulationService } from './triangulation.service';
import { VisionService } from '../vision/vision.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private triangulationService: TriangulationService,
    private visionService: VisionService,
  ) {}

  /**
   * Helper para calcular el nivel y rango comunitario según puntos
   */
  private calculateUserLevel(points: number): string {
    if (points >= 500) return 'Héroe Comunitario SLP 👑';
    if (points >= 300) return 'Guardián Potosino 🛡️';
    if (points >= 100) return 'Rastreador Activo 🧭';
    return 'Rescatista Novato 🐾';
  }

  // Guardar un nuevo reporte en la base de datos con visión IA y metadatos
  async create(data: CreateReportDto) {
    let reportUserId: string | null = null;

    // Si viene el correo del usuario autenticado, asociamos el reporte a su perfil
    if (data.userEmail) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.userEmail.toLowerCase().trim() },
      });
      if (existingUser) {
        reportUserId = existingUser.id;
      }
    }

    // Si no está autenticado, buscamos o creamos un usuario anónimo
    if (!reportUserId) {
      let anonUser = await this.prisma.user.findFirst({
        where: { email: 'anonimo@slp.com' },
      });

      if (!anonUser) {
        anonUser = await this.prisma.user.create({
          data: {
            email: 'anonimo@slp.com',
            name: 'Comunidad SLP',
          },
        });
      }
      reportUserId = anonUser.id;
    }

    const title = data.title?.trim() || data.petName?.trim() || 'Reporte de Mascota';
    const reward = data.reward ? Math.max(0, Number(data.reward)) : null;

    // Procesamiento seguro de hasta 3 fotografías
    let primaryImage: string | null = null;
    let finalMediaUrl: string | null = null;

    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const validImages = data.images.filter((img) => typeof img === 'string' && img.trim().length > 0).slice(0, 3);
      if (validImages.length > 0) {
        primaryImage = validImages[0];
        finalMediaUrl = validImages.length === 1 ? validImages[0] : JSON.stringify(validImages);
      }
    } else if (data.mediaUrl && typeof data.mediaUrl === 'string' && data.mediaUrl.trim().length > 0) {
      const trimmed = data.mediaUrl.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            primaryImage = parsed[0];
            finalMediaUrl = parsed.length === 1 ? parsed[0] : JSON.stringify(parsed.slice(0, 3));
          }
        } catch {
          primaryImage = trimmed;
          finalMediaUrl = trimmed;
        }
      } else {
        primaryImage = trimmed;
        finalMediaUrl = trimmed;
      }
    }

    // 1. Análisis con Visión IA Gratuita (Gemini Flash o Heurístico Local)
    const visionMeta = await this.visionService.analyzePetImage(primaryImage, {
      title,
      description: data.description,
      petName: data.petName,
      userSelectedSpecies: data.species,
    });

    const finalSpecies: Species = data.species || visionMeta.species || Species.DOG;
    const finalBreed: string | null = data.breed?.trim() || visionMeta.breed || null;
    const finalColor: string | null = data.primaryColor?.trim() || visionMeta.primaryColor || null;
    const finalSize: string | null = data.size?.trim() || visionMeta.size || 'MEDIANO';
    const finalTags: string[] = Array.from(new Set([...(data.aiTags || []), ...visionMeta.aiTags]));

    // 2. Guardamos el reporte con todas sus propiedades multi-especie
    return this.prisma.report.create({
      data: {
        title,
        petName: data.petName?.trim() || null,
        description: data.description,
        type: data.type || ReportType.LOST,
        species: finalSpecies,
        breed: finalBreed,
        primaryColor: finalColor,
        size: finalSize,
        aiTags: finalTags,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        mediaUrl: finalMediaUrl,
        contactPhone: data.contactPhone?.trim() || null,
        reward,
        status: data.status || Status.ACTIVE,
        userId: reportUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
            points: true,
            level: true,
          },
        },
      },
    });
  }

  // Traer reportes con opción de filtros (por tipo, estado o especie)
  async findAll(filter?: { type?: string; status?: string; species?: string }) {
    const where: any = {};
    if (filter?.type && Object.values(ReportType).includes(filter.type as ReportType)) {
      where.type = filter.type as ReportType;
    }
    if (filter?.status && Object.values(Status).includes(filter.status as Status)) {
      where.status = filter.status as Status;
    }
    if (filter?.species && Object.values(Species).includes(filter.species as Species)) {
      where.species = filter.species as Species;
    }

    return this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
            points: true,
            level: true,
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  // Traer un solo reporte por su ID
  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
            points: true,
            level: true,
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pointTransactions: true,
      },
    });
    if (!report) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }
    return report;
  }

  // Actualizar el estado de un reporte
  async updateStatus(id: string, status: Status) {
    const exists = await this.prisma.report.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    return this.prisma.report.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Cierre seguro de caso: Marcar animal como "Encontrado" y repartir puntos
   * REGLAS ESTRICTAS:
   * 1. Solo el dueño del reporte o un Administrador pueden ejecutarlo.
   * 2. Otorga 100 puntos a quien encontró al animal (finderUserId).
   * 3. Otorga 25 puntos a cada usuario con avistamiento validado.
   * 4. Previene auto-asignación de puntos entre el dueño y su propio reporte.
   * 5. Previene doble asignación de puntos (pointsAwarded flag).
   */
  async resolveReport(id: string, dto: ResolveReportDto) {
    if (!dto.requesterEmail) {
      throw new UnauthorizedException('El correo del solicitante es obligatorio para verificar permisos.');
    }

    const requester = await this.prisma.user.findUnique({
      where: { email: dto.requesterEmail.toLowerCase().trim() },
    });

    if (!requester) {
      throw new UnauthorizedException('Usuario solicitante no registrado en el sistema.');
    }

    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!report) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado.`);
    }

    // Comprobar permisos: Dueño legítimo o Rol ADMIN
    const isOwner = report.userId === requester.id;
    const isAdmin = requester.role === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Acción denegada: Únicamente el dueño legítimo del reporte o un Administrador pueden marcar al animal como Encontrado.',
      );
    }

    // Ejecutar reparto de puntos y resolución atómica en PostgreSQL
    return this.prisma.$transaction(async (tx) => {
      let awardedFinder = false;
      let awardedSightingsCount = 0;

      // Si aún no se han otorgado puntos para este reporte
      if (!report.pointsAwarded) {
        // 1. Otorgar 100 puntos al encontrador (si es distinto al dueño)
        if (dto.finderUserId && dto.finderUserId !== report.userId) {
          const finder = await tx.user.findUnique({ where: { id: dto.finderUserId } });
          if (finder) {
            const newPoints = finder.points + 100;
            const newLevel = this.calculateUserLevel(newPoints);
            await tx.user.update({
              where: { id: finder.id },
              data: { points: newPoints, level: newLevel },
            });

            await tx.pointTransaction.create({
              data: {
                userId: finder.id,
                amount: 100,
                reason: `Rescate exitoso (+100 pts): ${report.petName || report.title}`,
                reportId: report.id,
              },
            });
            awardedFinder = true;
          }
        }

        // 2. Otorgar 25 puntos a cada usuario con avistamiento validado
        if (Array.isArray(dto.validatedSightingIds) && dto.validatedSightingIds.length > 0) {
          const sightings = await tx.report.findMany({
            where: { id: { in: dto.validatedSightingIds } },
          });

          for (const s of sightings) {
            // No auto-otorgar puntos si el avistamiento lo subió el propio dueño
            if (s.userId && s.userId !== report.userId) {
              const witness = await tx.user.findUnique({ where: { id: s.userId } });
              if (witness) {
                const newPoints = witness.points + 25;
                const newLevel = this.calculateUserLevel(newPoints);
                await tx.user.update({
                  where: { id: witness.id },
                  data: { points: newPoints, level: newLevel },
                });

                await tx.pointTransaction.create({
                  data: {
                    userId: witness.id,
                    amount: 25,
                    reason: `Avistamiento clave validado (+25 pts): ${report.petName || report.title}`,
                    reportId: report.id,
                  },
                });
                awardedSightingsCount++;
              }
            }
          }
        }
      }

      // 3. Actualizar estado del reporte a RESOLVED
      return tx.report.update({
        where: { id },
        data: {
          status: Status.RESOLVED,
          resolvedByUserId: dto.finderUserId || null,
          validatedSightingIds: dto.validatedSightingIds || [],
          pointsAwarded: true,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, points: true, level: true },
          },
          resolvedByUser: {
            select: { id: true, name: true, email: true, points: true, level: true },
          },
          pointTransactions: true,
        },
      });
    });
  }

  /**
   * Cálculo del motor espacial de triangulación basado en especie y tiempo transcurrido
   */
  async getTriangulation(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
    });
    if (!report) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    // Traer todos los avistamientos registrados de la misma especie o cuadrante
    const allSightings = await this.prisma.report.findMany({
      where: {
        type: ReportType.SIGHTING,
        // Si el reporte especifica especie, filtrar por la misma especie o genérica
        ...(report.species && { species: report.species }),
      },
      orderBy: { createdAt: 'asc' },
    });

    // Filtramos avistamientos relevantes por cercanía o por coincidencia de nombre/descripción
    const petQuery = (report.petName || '').toLowerCase().trim();
    const relevantSightings = allSightings.filter((s) => {
      // Coincidencia por nombre si aplica
      if (petQuery && petQuery.length > 2 && (s.petName || '').toLowerCase().includes(petQuery)) {
        return true;
      }
      // O cercanía dentro de una ventana amplia de 25 km
      const dist = this.triangulationService.calculateDistanceKm(
        report.latitude,
        report.longitude,
        s.latitude,
        s.longitude,
      );
      return dist <= 25.0;
    });

    return this.triangulationService.calculateTriangulation(
      report,
      relevantSightings.map((s) => ({
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        createdAt: s.createdAt,
        title: s.title,
        description: s.description,
        userId: s.userId,
      })),
    );
  }

  // Actualizar datos de un reporte (con validación de permisos y soporte hasta 3 imágenes)
  async update(id: string, data: Partial<CreateReportDto>, requesterEmail?: string) {
    const exists = await this.prisma.report.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!exists) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    const emailToCheck = requesterEmail || data.userEmail;
    if (emailToCheck) {
      const requester = await this.prisma.user.findUnique({
        where: { email: emailToCheck.toLowerCase().trim() },
      });

      if (!requester) {
        throw new UnauthorizedException('Usuario no registrado.');
      }

      const isOwner = exists.userId === requester.id || exists.user?.email.toLowerCase() === requester.email.toLowerCase();
      const isAdmin = requester.role === Role.ADMIN || requester.email.toLowerCase() === 'armekmc54@gmail.com';

      if (!isOwner && !isAdmin) {
        throw new ForbiddenException('No tienes permisos para modificar este reporte.');
      }
    }

    // Manejo de fotografías (hasta 3 fotos completas almacenadas como JSON o URL directa)
    let finalMediaUrl = data.mediaUrl;
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      const cleanImages = data.images.filter((img) => typeof img === 'string' && img.trim().length > 0).slice(0, 3);
      if (cleanImages.length > 0) {
        finalMediaUrl = cleanImages.length === 1 ? cleanImages[0] : JSON.stringify(cleanImages);
      }
    }

    return this.prisma.report.update({
      where: { id },
      data: {
        ...(data.petName !== undefined && { petName: data.petName }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
        ...(data.reward !== undefined && { reward: data.reward ? Number(data.reward) : null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.species !== undefined && { species: data.species }),
        ...(data.breed !== undefined && { breed: data.breed }),
        ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
        ...(data.size !== undefined && { size: data.size }),
        ...(data.aiTags !== undefined && { aiTags: data.aiTags }),
        ...(finalMediaUrl !== undefined && { mediaUrl: finalMediaUrl }),
        ...(data.latitude !== undefined && { latitude: Number(data.latitude) }),
        ...(data.longitude !== undefined && { longitude: Number(data.longitude) }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
            points: true,
            level: true,
          },
        },
        resolvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pointTransactions: true,
      },
    });
  }

  // Eliminar un reporte con comprobación de permisos (dueño o admin) y eliminación en cascada atómica
  async remove(id: string, requesterEmail?: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!report) {
      throw new NotFoundException(`Reporte con ID ${id} no encontrado`);
    }

    if (requesterEmail) {
      const requester = await this.prisma.user.findUnique({
        where: { email: requesterEmail.toLowerCase().trim() },
      });

      if (!requester) {
        throw new UnauthorizedException('Usuario no registrado.');
      }

      const isOwner = report.userId === requester.id || report.user?.email.toLowerCase() === requester.email.toLowerCase();
      const isAdmin = requester.role === Role.ADMIN;

      if (!isOwner && !isAdmin) {
        throw new ForbiddenException('No tienes permisos para eliminar este reporte.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Eliminar mensajes asociados al reporte
      await tx.message.deleteMany({ where: { reportId: id } });
      // 2. Eliminar transacciones de puntos asociadas
      await tx.pointTransaction.deleteMany({ where: { reportId: id } });
      // 3. Eliminar el reporte
      return tx.report.delete({ where: { id } });
    });
  }
}