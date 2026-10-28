import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ClicksModule } from './clicks/clicks.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { CommonModule } from './common/common.module';
import { AppValidationPipe } from './common/validation.pipe';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { LinksModule } from './links/links.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedirectModule } from './redirect/redirect.module';
import { RedisModule } from './redis/redis.module';
import { SeedModule } from './seed/seed.module';

/** Root module. `RedirectModule` comes last so its `/:slug` route is registered after all others. */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    CommonModule,
    HealthModule,
    AuthModule,
    LinksModule,
    ClicksModule,
    SeedModule,
    RedirectModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: AppValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
