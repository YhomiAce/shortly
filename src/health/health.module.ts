import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Health endpoint. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
