# Quizzty

![Изображение Quizzty](./img/quizzty.png)

Веб-приложение для проведения квизов в реальном времени 🎯

**Приложение**: https://quizzty.vercel.app

**Swagger API**: https://quizzty-production.up.railway.app/api/docs

**Макет**: [Figma](https://www.figma.com/design/QVySygdubzDYWMqjcsXm9w/Quizzty-Landing-by-Winterful?node-id=0-1&t=iQbfVf5DYbXe3Jtw-1)

## Стек технологий

- **Фронтенд**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Бэкенд**: NestJS 11, TypeScript, Prisma 7
- **База данных**: PostgreSQL, Redis
- **Реалтайм**: Socket.IO + Redis Adapter
- **Аутентификация**: JWT (access + refresh tokens, httpOnly cookies)
- **Инфраструктура**: Docker, Turborepo, Bun
- **CI/CD**: GitHub Actions, Vercel (фронтенд), Railway (бэкенд + БД)

## Структура проекта

```
quizzty/
├── apps/
│   ├── web/            # Next.js фронтенд (порт 3000)
│   └── api/            # NestJS бэкенд (порт 4000)
├── packages/
│   └── shared/         # Общие типы и интерфейсы
├── docker-compose.yml  # PostgreSQL и Redis для локальной разработки
├── Dockerfile          # Продакшн-образ API для Railway
└── turbo.json          # Конфигурация Turborepo
```

## Локальная разработка

### Требования

- [Bun](https://bun.sh/) 1.3+
- Docker и Docker Compose

### Установка и запуск

```bash
# 1. Клонировать репозиторий
git clone https://github.com/Winterfulllll/Quizzty.git
cd Quizzty

# 2. Поднять базы данных
docker compose up -d

# 3. Установить зависимости
bun install

# 4. Настроить переменные окружения
cp apps/api/.env.example apps/api/.env

# 5. Сгенерировать клиент Prisma и применить миграции
cd apps/api
bunx prisma generate
bunx prisma migrate dev
cd ../..

# 6. Запустить dev-серверы
bun run dev
```

### Локальные ссылки

- Фронтенд: http://localhost:3000
- API: http://localhost:4000/api
- Swagger API: http://localhost:4000/api/docs

## Деплой

- **Фронтенд** деплоится на [Vercel](https://vercel.com) автоматически при пуше в `main`
- **Бэкенд** деплоится на [Railway](https://railway.app) через Docker при пуше в `main`
