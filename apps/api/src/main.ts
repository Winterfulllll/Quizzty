import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { RedisIoAdapter } from './redis/redis-io.adapter.js';
import { Server } from 'http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());

  const corsOrigin = (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const redisAdapter = new RedisIoAdapter(app.getHttpServer() as Server, redisUrl);
  await redisAdapter.connectToRedis();
  app.useWebSocketAdapter(redisAdapter);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Quizzty API')
    .setDescription('API для проведения квизов в реальном времени')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('PORT') ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://localhost:${String(port)}`);
  console.log(`Swagger: http://localhost:${String(port)}/api/docs`);
}

void bootstrap();
