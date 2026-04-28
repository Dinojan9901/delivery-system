# QuickDeliver — Cloud-Native Food Delivery System
[![CI/CD Pipeline](https://github.com/Dinojan9901/delivery-system/actions/workflows/ci.yml/badge.svg)](https://github.com/Dinojan9901/delivery-system/actions)
> EC7204 Cloud Computing | University of Ruhuna, Faculty of Engineering | Semester 7, April 2026

A microservices-based food delivery platform demonstrating core cloud computing principles: scalability, high availability, security, synchronous & asynchronous communication, and containerized deployment.

---

## Architecture Overview

```
                         ┌──────────────────────────────┐
                         │     Nginx API Gateway        │
Browser ────────────────▶│         (Port 80)            │
                         │  Load Balancer + Router      │
                         └──────┬───────────┬───────────┘
                                │           │
               /api/auth        │           │  /api/orders (load balanced)
               /api/notifications│          │
                    ┌───────────┘           └──────────────────────┐
                    │                                              │
          ┌─────────▼────────┐    ┌──────────────┐   ┌───────────▼─────────┐
          │  Auth Service    │    │Order Service │   │  Order Service      │
          │  (port 3001)     │    │  replica 1   │   │    replica 2 ...    │
          └─────────┬────────┘    └──────┬───────┘   └───────────┬─────────┘
                    │                    │ publish                │
                 MongoDB             RabbitMQ ◀──────────────────┘
                (auth-db)         (order_notifications)
                                         │ consume
                              ┌──────────▼──────────┐
                              │ Notification Service │
                              │    (port 3003)       │
                              └─────────────────────┘
```

### Services

| Service              | Port (internal) | Responsibility                              |
|----------------------|-----------------|---------------------------------------------|
| gateway (Nginx)      | **80 (public)** | API gateway, load balancer, serves frontend |
| auth-service         | 3001            | Register, login, JWT generation             |
| order-service        | 3002            | CRUD orders, publishes events to RabbitMQ   |
| notification-service | 3003            | Consumes queue, stores notifications        |
| mongodb              | 27017           | Database (3 separate logical DBs)           |
| rabbitmq             | 5672 / 15672    | Message broker (async communication)        |

---

## Cloud Computing Principles Implemented

| Principle              | Implementation                                                          |
|------------------------|-------------------------------------------------------------------------|
| **Scalability**        | `--scale order-service=N` — Nginx load-balances across replicas         |
| **High Availability**  | `restart: on-failure` on all services; automatic retry on startup       |
| **Sync Communication** | REST APIs — Frontend → Gateway → Auth / Order / Notification Services   |
| **Async Communication**| RabbitMQ queue — Order Service publishes, Notification Service consumes |
| **Security**           | JWT authentication, bcrypt password hashing, RBAC, secrets via `.env`  |
| **Deployment Tools**   | Docker + Docker Compose, CI/CD via GitHub Actions                       |
| **Extensibility**      | Add a new service → one entry in compose + one nginx location block     |
| **Database**           | MongoDB — flexible document schema suits orders and notifications        |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Git

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Dinojan9901/delivery-system.git
cd delivery-system
```

### 2. Configure environment

```bash
cp .env.example .env
```

The default `.env` works out of the box for local development. Change `JWT_SECRET` for production.

### 3. Start all services

```bash
docker compose up --build
```

Wait ~40 seconds for all services to initialize (RabbitMQ takes longest).

### 4. Open the application

```
http://localhost
```

---

## Demo Accounts

Register these via the UI on first run:

| Role     | Email               | Password    |
|----------|---------------------|-------------|
| Customer | alice@example.com   | password123 |
| Admin    | admin@example.com   | admin123    |

---

## Demonstrating Scalability

Because `order-service` uses `expose` instead of a hardcoded host port, Docker can run multiple replicas without port conflicts. Nginx automatically load-balances across all replicas using round-robin.

```bash
# Start with 3 order-service replicas
docker compose up --build --scale order-service=3
```

Verify load balancing — watch which container handles each request:

```bash
docker compose logs -f order-service
```

Place multiple orders in the UI — requests will be distributed across different replica containers.

---

## API Reference

All API calls go through the gateway at `http://localhost`.

### Auth Service (`/api/auth`)

| Method | Endpoint             | Auth | Description          |
|--------|----------------------|------|----------------------|
| POST   | /api/auth/register   | No   | Register a new user  |
| POST   | /api/auth/login      | No   | Login, receive JWT   |
| GET    | /api/auth/me         | Yes  | Verify token         |

```bash
# Register
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"password123","role":"customer"}'

# Login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
```

### Order Service (`/api/orders`)

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint                | Role     | Description          |
|--------|-------------------------|----------|----------------------|
| POST   | /api/orders             | Customer | Place a new order    |
| GET    | /api/orders             | Any      | Get orders           |
| GET    | /api/orders/:id         | Any      | Get order by ID      |
| PUT    | /api/orders/:id/status  | Admin    | Update order status  |
| DELETE | /api/orders/:id         | Any      | Cancel order         |

```bash
curl -X POST http://localhost/api/orders \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantName": "Pizza Palace",
    "deliveryAddress": "42 Main St, Colombo",
    "items": [
      {"name": "Margherita Pizza", "quantity": 1, "price": 12.99},
      {"name": "Garlic Bread", "quantity": 2, "price": 3.50}
    ]
  }'
```

**Order status flow:** `pending` → `confirmed` → `preparing` → `out_for_delivery` → `delivered`

### Notification Service (`/api/notifications`)

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint                          | Description                      |
|--------|-----------------------------------|----------------------------------|
| GET    | /api/notifications                | Get notifications (role-scoped)  |
| GET    | /api/notifications/order/:orderId | Get notifications for an order   |

---

## Security

- **JWT Authentication** — all protected endpoints require a Bearer token
- **bcrypt** — passwords hashed with 10 salt rounds before storage
- **Role-Based Access Control** — customers see only their own data; admins see all
- **Secrets management** — JWT secret stored in `.env`, injected via environment variables (never hardcoded)
- **Notification auth** — notification endpoints require valid JWT (customers are automatically scoped to their own notifications)

---

## CI/CD Pipeline

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push to `main`:

1. Builds all Docker images
2. Starts the full stack
3. Waits for services to initialize
4. Hits `/health` endpoint to verify gateway is responding
5. Tests auth service by registering a user
6. Tears down cleanly

To enable: add `JWT_SECRET` as a GitHub Actions secret in your repository settings.

---

## Database Schemas

### User (auth-db)
```json
{
  "name": "string (required)",
  "email": "string (required, unique)",
  "password": "string (bcrypt hashed)",
  "role": "customer | admin",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Order (order-db)
```json
{
  "customerId": "string",
  "customerEmail": "string",
  "restaurantName": "string",
  "deliveryAddress": "string",
  "items": [{ "name": "string", "quantity": "number", "price": "number" }],
  "totalAmount": "number",
  "status": "pending | confirmed | preparing | out_for_delivery | delivered | cancelled",
  "notes": "string (optional)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Notification (notification-db)
```json
{
  "orderId": "string",
  "customerId": "string",
  "customerEmail": "string",
  "eventType": "ORDER_PLACED | ORDER_STATUS_UPDATED | ORDER_CANCELLED",
  "message": "string",
  "status": "sent | failed",
  "createdAt": "timestamp"
}
```

---

## Project Structure

```
delivery-system/
├── .env.example              ← environment variable template
├── .gitignore
├── docker-compose.yml        ← orchestrates all services
├── README.md
├── seed-data.json            ← sample users and orders
├── .github/
│   └── workflows/
│       └── ci.yml            ← GitHub Actions CI pipeline
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf            ← API gateway + load balancer config
├── auth-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── middleware/auth.js
│       ├── models/User.js
│       └── routes/auth.js
├── order-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── middleware/auth.js
│       ├── models/Order.js
│       ├── rabbitmq/publisher.js
│       └── routes/orders.js
├── notification-service/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── middleware/auth.js
│       ├── models/Notification.js
│       └── rabbitmq/consumer.js
└── frontend/
    ├── Dockerfile
    └── index.html
```

---

## Useful Commands

```bash
# Start normally
docker compose up --build

# Start with 3 order-service replicas (scalability demo)
docker compose up --build --scale order-service=3

# View logs for a specific service
docker compose logs -f order-service

# Check running containers
docker compose ps

# Stop all services
docker compose down

# Stop and wipe database volumes (full reset)
docker compose down -v
```

---

## Monitoring & Debug

| URL                        | Purpose                        | Credentials     |
|----------------------------|--------------------------------|-----------------|
| http://localhost           | Frontend application           | —               |
| http://localhost/health    | Gateway health check           | —               |
| http://localhost:15672     | RabbitMQ management UI         | guest / guest   |

---

## Tech Stack

| Component      | Technology                  |
|----------------|-----------------------------|
| Runtime        | Node.js 18 (Alpine)         |
| Framework      | Express.js 4.18             |
| Database       | MongoDB 6 + Mongoose 8      |
| Message Queue  | RabbitMQ 3                  |
| Authentication | JWT + bcrypt                |
| Gateway        | Nginx (Alpine)              |
| Containers     | Docker + Docker Compose 3.8 |
| CI/CD          | GitHub Actions              |
| Frontend       | Vanilla JavaScript + HTML5  |
