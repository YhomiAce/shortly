import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';

/** First-start sample data. */
@Module({ providers: [SeedService] })
export class SeedModule {}
