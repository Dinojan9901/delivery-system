# QuickDeliver — Cloud-Native Food Delivery System

A microservices-based food delivery application built with Node.js, MongoDB, RabbitMQ, and Nginx — deployed with Docker Compose.

---

## Architecture

```
                         ┌──────────────────────────────┐
                         │     Nginx API Gateway        │
Browser ────────────────▶│         (Port 80)            │
                         │  Load Balancer + Router      │
                         └──────┬──────────┬────────────┘
                                │          │
               /api/auth        │          │  /api/orders (load balanced)
               /api/notifications│         │
                    ┌───────────┘          └──────────────────────┐
                    │                                             │
          ┌─────────▼────────┐     ┌──────────────┐   ┌──────────▼──────────┐
          │  Auth Service    │     │Order Service │   │  Order Service      │
          │  (port 3001)     │     │  replica 1   │   │    replica 2 ...    │
          └─────────┬────────┘     └──────┬───────┘   └──────────┬──────────┘
                    │                     │ publish               │
                 MongoDB              RabbitMQ ◀─────────────────┘
                (auth-db)          (order_notifications)
                                          │ consume
                               ┌──────────▼──────────┐
                               │ Notification Service │
                               │    (port 3003)       │
                               └─────────────────────┘
```

### Services

| Service              | Internal Port | Responsibility                          |
|----------------------|---------------|-----------------------------------------|
| gateway (Nginx)      | **80 (public)**| API gateway, load balancer, serves UI  |
| auth-service         | 3001 (internal)| Register, login, JWT generation        |
| order-service        | 3002 (internal)| CRUD orders, publishes to RabbitMQ     |
| notification-service | 3003 (internal)| Consumes queue, stores notifications   |
| mongodb              | 27017         | Database (3 separate logical DBs)       |
| rabbitmq             | 5672 / 15672  | Message broker (async communication)   |

> All service ports are internal only. Only port **80** (gateway) is exposed to the host.

---

## Prerequisites

- Docker Desktop (or Docker + Docker Compose v2)
- Git

---

## How to Run

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd delivery-system
```

### 2. Start all services
```bash
docker compose up --build
```

Wait ~30 seconds for all services to initialize (RabbitMQ takes longest).

### 3. Open the application
```
http://localhost
```

### Demo accounts

| Role     | Email               | Password    |
|----------|---------------------|-------------|
| Customer | alice@example.com   | password123 |
| Admin    | admin@example.com   | admin123    |

Register these via the UI on first run.

---

## Demonstrating Scalability (15% marks)

Because `order-service` uses `expose` instead of a hardcoded host port, Docker can run multiple replicas without port conflicts. Nginx automatically load-balances across all replicas using round-robin.

```bash
# Start with 3 order-service replicas
docker compose up --build --scale order-service=3
```

To verify load balancing is working, check which container handles each request:
```bash
# In a separate terminal, watch order-service logs across all replicas
docker compose logs -f order-service
```

Place multiple orders in the UI — you will see requests distributed across different replica containers.

---

## API Reference

All API calls go through the gateway at `http://localhost`. No port numbers needed.

### Auth Service

| Method | Endpoint            | Description         | Auth |
|--------|---------------------|---------------------|------|
| POST   | /api/auth/register  | Register a new user | No   |
| POST   | /api/auth/login     | Login, get JWT      | No   |
| GET    | /api/auth/me        | Verify token        | Yes  |

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

### Order Service

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint                | Description            | Role     |
|--------|-------------------------|------------------------|----------|
| POST   | /api/orders             | Place a new order      | Customer |
| GET    | /api/orders             | Get orders             | Any      |
| GET    | /api/orders/:id         | Get order by ID        | Any      |
| PUT    | /api/orders/:id/status  | Update order status    | Admin    |
| DELETE | /api/orders/:id         | Cancel pending order   | Any      |

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

### Notification Service

| Method | Endpoint                           | Description                |
|--------|------------------------------------|----------------------------|
| GET    | /api/notifications                 | All notifications          |
| GET    | /api/notifications?email=x@y.com  | Filter by customer email   |
| GET    | /api/notifications/order/:orderId  | Notifications for an order |

---

## Health Check

```bash
curl http://localhost/health
```

---

## RabbitMQ Management UI

```
http://localhost:15672
Username: guest  |  Password: guest
```

---

## How Cloud Principles Are Implemented

| Requirement              | Implementation                                                      |
|--------------------------|---------------------------------------------------------------------|
| Scalability              | `--scale order-service=3` — Nginx load-balances across replicas    |
| High Availability        | `restart: on-failure` on all services; gateway stays up            |
| Sync Communication       | REST (Frontend → Gateway → Auth / Order / Notification Service)    |
| Async Communication      | RabbitMQ queue (Order Service → Notification Service)               |
| Security                 | JWT auth, bcrypt password hashing, secrets via environment vars    |
| Deployment Tools         | Docker Compose, Dockerfiles per service                            |
| Extensibility            | Add a new service → add to compose + one nginx location block      |
| Database choice          | MongoDB — flexible schema, suits order and notification documents   |

---

## Project Structure

```
delivery-system/
├── docker-compose.yml
├── README.md
├── seed-data.json
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf          ← API gateway + load balancer config
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
│       ├── models/Notification.js
│       └── rabbitmq/consumer.js
└── frontend/
    └── index.html
```

---

## Stop / Reset

```bash
docker compose down          # stop containers
docker compose down -v       # stop and wipe database volumes
```
