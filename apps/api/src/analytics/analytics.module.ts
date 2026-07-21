import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { DbModule } from '../db/db.module.js';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    DbModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
