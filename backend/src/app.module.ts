import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { MessagesModule } from './messages/messages.module';
import { VisionModule } from './vision/vision.module';

@Module({
  imports: [PrismaModule, ReportsModule, UsersModule, MessagesModule, VisionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
