import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LinkCacheService } from './link-cache.service';
import { LinkCreationRateLimitGuard } from './link-creation-rate-limit.guard';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

/** Short-link management. */
@Module({
  imports: [AuthModule],
  controllers: [LinksController],
  providers: [LinksService, LinkCacheService, LinkCreationRateLimitGuard],
  exports: [LinksService],
})
export class LinksModule {}
