import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Makes {@link PrismaService} available everywhere. */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
