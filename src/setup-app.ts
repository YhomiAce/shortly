import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppConfig } from './config/env';

/**
 * Applies HTTP-level settings shared by `main.ts` and the e2e tests:
 * proxy trust, CORS and the Swagger UI at `/api/docs`.
 */
export function setupApp(app: NestExpressApplication, config: AppConfig): void {
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.enableShutdownHooks();

  if (config.corsOrigins !== false) {
    app.enableCors({
      origin: config.corsOrigins,
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After', 'Content-Disposition'],
      maxAge: 600,
    });
  }

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('shortly API')
      .setDescription(
        'URL shortener with click analytics. Management endpoints need `Authorization: Bearer <API key>`. ' +
          'Short links are served at `GET /{slug}`.',
      )
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'An API key (ADMIN_API_KEY or one created via /api/keys)' })
      .build(),
  );
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document), {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
