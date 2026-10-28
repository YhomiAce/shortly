import { Module } from '@nestjs/common';
import { ClicksModule } from '../clicks/clicks.module';
import { LinksModule } from '../links/links.module';
import { RedirectController } from './redirect.controller';

/** Public redirect routes. Imported last so `/:slug` never shadows other routes. */
@Module({ imports: [LinksModule, ClicksModule], controllers: [RedirectController] })
export class RedirectModule {}
