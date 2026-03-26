# Quizzty

Веб-приложение для проведения квизов в реальном времени 🎯

[Макет](https://www.figma.com/design/QVySygdubzDYWMqjcsXm9w/Quizzty-Landing-by-Winterful?node-id=0-1&p=f&t=v1Whp7uU1alC2oXQ-0)

## Стек технологий

- **Фронтенд**: Next.js 16, React, TypeScript, Tailwind CSS
- **Бэкенд**: NestJS, TypeScript, Prisma 7
- **База данных**: PostgreSQL
- **Реалтайм**: Socket.IO
- **Инфраструктура**: Docker Compose, Turborepo, Bun

## Структура проекта

```
quizzty/
├── apps/
│   ├── web/            # Next.js фронтенд (порт 3000)
│   └── api/            # NestJS бэкенд (порт 4000)
├── packages/
│   └── shared/         # Общие типы и интерфейсы
├── docker-compose.yml  # PostgreSQL и Redis
└── turbo.json          # Конфигурация Turborepo
```

## Начало работы

### Требования

- [Bun](https://bun.sh/) 1.3+
- Docker и Docker Compose

### Установка и запуск

```bash
# 1. Поднять базы данных
docker compose up -d

# 2. Установить зависимости
bun install

# 3. Сгенерировать клиент Prisma и применить миграции
cd apps/api
bunx prisma generate
bunx prisma migrate dev --name init
cd ../..

# 4. Запустить dev-серверы
bun run dev
```

- Фронтенд: http://localhost:3000
- API: http://localhost:4000/api
