import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { RedisIoAdapter } from './redis/redis-io.adapter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000',
    credentials: true,
  });

  const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const redisAdapter = new RedisIoAdapter(app, redisUrl);
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
  await app.listen(port);
  console.log(`API running on http://localhost:${String(port)}`);
  console.log(`Swagger: http://localhost:${String(port)}/api/docs`);
}

void bootstrap();
