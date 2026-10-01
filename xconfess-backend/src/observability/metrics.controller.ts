import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { OperationalMetricsService } from './operational-metrics.service';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: OperationalMetricsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Privacy-safe operational metrics (Prometheus text format)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Request latency/status by safe route category and feed query latency. Labels never contain user or confession identifiers.',
  })
  getMetrics(): string {
    return this.metrics.renderPrometheus();
  }
}
