import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService, KpisResponse, SalesChartData, TopProduct } from './analytics.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpis')
  async getKpis(): Promise<KpisResponse> {
    return this.analyticsService.getKpis();
  }

  @Get('sales-chart')
  async getSalesChart(): Promise<SalesChartData[]> {
    return this.analyticsService.getSalesChart();
  }

  @Get('top-products')
  async getTopProducts(): Promise<TopProduct[]> {
    return this.analyticsService.getTopProducts();
  }
}
