import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateMessageDto {
  senderEmail: string;
  receiverEmail?: string;
  receiverId?: string;
  reportId?: string;
  content: string;
}

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  // Enviar mensaje entre usuarios
  async create(data: CreateMessageDto) {
    if (!data.content?.trim()) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }

    // 1. Identificar al remitente
    const sender = await this.prisma.user.findUnique({
      where: { email: data.senderEmail.toLowerCase().trim() },
    });
    if (!sender) {
      throw new NotFoundException(`Remitente ${data.senderEmail} no encontrado`);
    }

    // 2. Identificar al receptor
    let receiverId = data.receiverId;
    if (!receiverId && data.receiverEmail && data.receiverEmail.toLowerCase().trim() !== 'anonimo@slp.com') {
      const receiver = await this.prisma.user.findUnique({
        where: { email: data.receiverEmail.toLowerCase().trim() },
      });
      if (receiver) receiverId = receiver.id;
    }

    // Si viene reportId, resolver el dueño del reporte o enlazar por teléfono si el reporte era anónimo
    if (data.reportId) {
      const report = await this.prisma.report.findUnique({
        where: { id: data.reportId },
        include: { user: true },
      });
      if (report) {
        // Si el receptor no se ha definido o apunta al usuario anónimo comunitario
        if (!receiverId || (report.user && report.user.email === 'anonimo@slp.com')) {
          if (report.contactPhone) {
            const cleanPhone = report.contactPhone.replace(/\D/g, '');
            if (cleanPhone.length >= 10) {
              const last10 = cleanPhone.slice(-10);
              const usersWithPhone = await this.prisma.user.findMany({
                where: { phone: { not: null } },
                select: { id: true, phone: true },
              });
              const matchingUser = usersWithPhone.find(
                (u) => u.phone && u.phone.replace(/\D/g, '').endsWith(last10)
              );
              if (matchingUser) {
                receiverId = matchingUser.id;
                // Vincular formalmente el reporte para el futuro
                await this.prisma.report.update({
                  where: { id: report.id },
                  data: { userId: matchingUser.id },
                });
              }
            }
          }
        }
        if (!receiverId) {
          receiverId = report.userId;
        }
      }
    }

    if (!receiverId) {
      throw new BadRequestException('No se pudo determinar el destinatario del mensaje.');
    }

    if (receiverId === sender.id) {
      throw new BadRequestException('No puedes enviarte un mensaje a ti mismo sobre tu propio reporte.');
    }

    // Validar si el destinatario final sigue siendo la cuenta anónima comunitaria
    const finalReceiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      select: { email: true },
    });
    if (finalReceiver?.email === 'anonimo@slp.com') {
      throw new BadRequestException(
        'Esta publicación fue creada anónimamente sin una cuenta registrada. Por favor comunícate directamente mediante el teléfono o WhatsApp publicado.'
      );
    }

    // 3. Crear el mensaje
    return this.prisma.message.create({
      data: {
        content: data.content.trim(),
        senderId: sender.id,
        receiverId,
        reportId: data.reportId || null,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
        },
        receiver: {
          select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
        },
        report: {
          select: { id: true, petName: true, title: true, type: true, mediaUrl: true },
        },
      },
    });
  }

  // Obtener historial de mensajes de un usuario (recibidos y enviados)
  async findAllForUser(userEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: userEmail.toLowerCase().trim() },
    });
    if (!user) {
      return [];
    }

    return this.prisma.message.findMany({
      where: {
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
        },
        receiver: {
          select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
        },
        report: {
          select: { id: true, petName: true, title: true, type: true, mediaUrl: true },
        },
      },
    });
  }

  // Marcar mensaje como leído
  async markAsRead(id: string) {
    return this.prisma.message.update({
      where: { id },
      data: { read: true },
    });
  }
}
