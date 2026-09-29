import { Controller, Get, Post, Body, Patch, Param, Query } from '@nestjs/common';
import { MessagesService, CreateMessageDto } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(@Body() createDto: CreateMessageDto) {
    return this.messagesService.create(createDto);
  }

  @Get()
  findAllForUser(@Query('userEmail') userEmail: string) {
    return this.messagesService.findAllForUser(userEmail || '');
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.messagesService.markAsRead(id);
  }
}
