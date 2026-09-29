import { Controller, Get, Post, Patch, Body, Query } from '@nestjs/common';
import { UsersService, SyncUserDto, UpdateProfileDto } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  syncUser(@Body() data: SyncUserDto) {
    return this.usersService.syncUser(data);
  }

  @Get('profile')
  getProfile(@Query('email') email: string) {
    return this.usersService.getProfile(email);
  }

  @Patch('profile')
  updateProfile(
    @Query('email') email: string,
    @Body() data: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(email, data);
  }

  @Post('make-admin')
  makeAdmin(
    @Body('email') email: string,
    @Body('adminCode') adminCode: string,
  ) {
    return this.usersService.makeAdmin(email, adminCode);
  }
}
