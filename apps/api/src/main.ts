import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
