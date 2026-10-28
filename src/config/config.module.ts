import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './env';

/** Provides the validated {@link AppConfig} under the {@link APP_CONFIG} token. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
