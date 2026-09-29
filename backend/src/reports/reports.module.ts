import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TriangulationService } from './triangulation.service';
import { VisionModule } from '../vision/vision.module';

@Module({
  imports: [VisionModule],
  controllers: [ReportsController],
  providers: [ReportsService, TriangulationService],
  exports: [ReportsService, TriangulationService],
})
export class ReportsModule {}
