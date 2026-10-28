import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ClickRecorderService } from './click-recorder.service';
import { AuthModule } from '../auth/auth.module';

/** Click recording and analytics. */
@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ClickRecorderService],
  exports: [ClickRecorderService],
})
export class ClicksModule {}
