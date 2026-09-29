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
    if (!receiverId && data.receiverEmail) {
      const receiver = await this.prisma.user.findUnique({
        where: { email: data.receiverEmail.toLowerCase().trim() },
      });
      if (receiver) receiverId = receiver.id;
    }

    // Si viene reportId y no se especificó receptor, el receptor es el dueño del reporte
    if (!receiverId && data.reportId) {
      const report = await this.prisma.report.findUnique({
        where: { id: data.reportId },
        select: { userId: true },
      });
      if (report) receiverId = report.userId;
    }

    if (!receiverId) {
      throw new BadRequestException('No se pudo determinar el destinatario del mensaje');
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
