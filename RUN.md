# AssetFlow

AssetFlow – веб-система для учета оборудования, программного обеспечения, заявок, актов, сотрудников, уведомлений и аналитики IT-отдела.

## Технологии

- **Backend:** Java 21, Spring Boot, Spring Security, Spring Data JPA, Flyway, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Axios, React Query, Tailwind CSS
- **Тестирование:** Playwright

## Требования

- **Java 21**
- **Node.js 20+**
- **PostgreSQL 16+**
- **Git**

## Переменные окружения

Для запуска backend требуется JWT-секрет длиной не менее 32 символов:

```powershell
$env:JWT_SECRET="local-development-jwt-secret-32chars"
```

По умолчанию backend ожидает PostgreSQL по адресу:

```text
jdbc:postgresql://127.0.0.1:5432/itam?sslmode=disable
```

Параметры подключения можно переопределить:

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:5432/itam?sslmode=disable"
$env:SPRING_DATASOURCE_USERNAME="itam"
$env:SPRING_DATASOURCE_PASSWORD="itam"
```

## Подготовка базы данных

Для запуска проекта нужно установить PostgreSQL локально, создать базу данных и пользователя.

Пример SQL-команд:

```sql
CREATE USER itam WITH PASSWORD 'itam';
CREATE DATABASE itam OWNER itam;
```

При старте backend Flyway автоматически применит SQL-миграции и создаст структуру базы данных.

## Запуск backend

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:5432/itam?sslmode=disable"
$env:SPRING_DATASOURCE_USERNAME="itam"
$env:SPRING_DATASOURCE_PASSWORD="itam"
$env:JWT_SECRET="local-development-jwt-secret-32chars"
cd backend
.\mvnw.cmd spring-boot:run
```

Backend будет доступен по адресу:

```text
http://localhost:8081
```

## Запуск frontend

В отдельном терминале выполните:

```powershell
cd frontend
npm install
npm run dev
```

Frontend будет доступен по адресу:

```text
http://localhost:5173
```

## Сборка

Backend:

```powershell
cd backend
.\mvnw.cmd clean package
```

Frontend:

```powershell
cd frontend
npm install
npm run build
```

## Приемочные тесты

```powershell
cd frontend
npm run test:acceptance
```

Перед запуском приемочных тестов должны быть запущены PostgreSQL, backend и frontend
