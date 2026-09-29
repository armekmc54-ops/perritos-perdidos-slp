import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto, ResolveReportDto } from './dto/create-report.dto';
import { Status } from '@prisma/client';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@Body() createReportDto: CreateReportDto) {
    return this.reportsService.create(createReportDto);
  }

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('species') species?: string,
  ) {
    return this.reportsService.findAll({ type, status, species });
  }

  @Get(':id/triangulation')
  getTriangulation(@Param('id') id: string) {
    return this.reportsService.getTriangulation(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: Status,
  ) {
    return this.reportsService.updateStatus(id, status);
  }

  /**
   * Cierre seguro de reporte: Solo dueño legítimo o Administrador pueden marcar
   * el animal como Encontrado y repartir los puntos de recompensa a los involucrados.
   */
  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() resolveDto: ResolveReportDto,
  ) {
    return this.reportsService.resolveReport(id, resolveDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateReportDto>,
  ) {
    return this.reportsService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }
}