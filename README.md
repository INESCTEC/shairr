# ShAIRR

ShAIRR can be started using Docker Compose and includes everything required to run the application locally.

If you just want to get started, follow the Quick Start section below. The remainder of this document covers configuration, development workflows, and project internals.

---

# Quick Start

## Prerequisites

Before getting started, make sure you have:

- Docker installed
- Docker Compose available (`docker compose`)

For most users, Docker Desktop already includes everything required.

## Start ShAIRR

From the project root directory, run:

```bash
cp .env.example .env

docker compose up --build
```

Docker Compose will build and start all required services:

- Frontend
- Backend API
- Keycloak
- Keycloak Database

The initial startup may take a few minutes while Docker downloads images and builds the containers.

## Open the Application

Once all services are running, open:

<http://localhost:4200>

You should now be able to access ShAIRR's interface through the default authentication combination: `shairr`: `shairr`


## Passwords and secrets

**Warning:** This demonstration runs with many default secrets and passwords.
If you wish to deploy ShAIRR for general use make sure to check, change and regenerate passwords in the following files:

- `.env`: Contains keys used to generate encryption salts
- Any `docker-compose.yml`: Contains keycloak's admin and database users
- `keycloak/import/shairr-realm.json`: Contains users and application secrets

---

# Development Mode

ShAIRR also provides a development-focused Docker Compose configuration.

This mode is intended for developers working on the frontend and backend services, allowing source code changes to be picked up without rebuilding containers after every modification.

Start the development environment with:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Development mode provides:

- Source code mounted into containers
- Hot reload support where available
- Faster development workflows
- Easier debugging of individual services

The application remains available at:

<http://localhost:4200>

---

# Advanced Usage

The sections below provide additional information about configuration, development workflows, infrastructure, and project architecture.

## Configuration

ShAIRR ships with a `.env` file in the project root containing default values suitable for local development.

Most users can leave these values unchanged. If required, you can customize authentication settings, storage locations, secrets, and other application configuration before starting the environment.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `auth.url` | Base URL of the Keycloak authentication server |
| `auth.realm` | Keycloak realm name |
| `auth.client_id` | OAuth client identifier |
| `auth.client_secret` | OAuth client secret used by the backend |
| `jwt_secret` | Secret used for signing JWT tokens |
| `hash_salt` | Salt value used in password hashing |
| `SHARED_DATA_ROOT` | Mount path for shared data inside containers |
| `SHARED_DATA_HOST_PATH` | Mount path for shared data on the host machine |

> **Security note:** The default secrets included with the repository are intended for local development only. Replace them before deploying ShAIRR to any shared or production environment.

---

## Running Services Individually

Docker Compose is the recommended way to run ShAIRR. However, individual services can also be started separately during development.

### Frontend (Angular)

**Requirements**

- Node.js
- npm
- Angular CLI

```bash
cd frontend

npm install
npm run start
```

The frontend will be available at:

<http://localhost:4200>

If the backend is not running locally, use:

```bash
npm run start-remote
```

to connect to a remote API instance.

### Backend (Python / FastAPI)

**Requirements**

- Python 3.13+
- pip

```bash
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

python3 main.py
```

The API will be available at:

<http://localhost:8000>

Interactive API documentation:

<http://localhost:8000/docs>

---

## Docker Compose Files

ShAIRR includes two Docker Compose configurations.

### docker-compose.yml

The default ShAIRR environment.

This configuration starts all services as a complete, self-contained deployment and is the recommended way to run the application.

```bash
docker compose up --build
```

### docker-compose.dev.yml

The development environment.

This configuration is intended for active development of frontend and backend components.

```bash
docker compose -f docker-compose.dev.yml up --build
```

Key differences include:

- Source code volume mounts
- Development-focused container configuration
- Hot reload support
- Faster feedback during development

---

## Architecture

ShAIRR consists of four services:

| Service | Technology | Purpose |
|----------|------------|----------|
| **Frontend** | Angular 18 + Angular CLI | Web application UI, served via Nginx in the standard deployment |
| **Backend** | Python 3.13 + FastAPI | REST API, business logic, and database management |
| **Keycloak** | Keycloak 26.0.6 | Identity and access management |
| **Keycloak DB** | PostgreSQL 16 | Database backing Keycloak |

All services communicate through an internal Docker network created automatically by Docker Compose.

---

## Keycloak

The default environment includes a preconfigured Keycloak instance.

**Admin username and password**

```text
Usernname: admin
Password: admin
```

**Admin Console**

<http://localhost:8080/auth/admin>

Realm configuration files are imported automatically from:

```text
keycloak/import/
```

Modify these files if you need to customize realms, users, roles, or clients.

---

## Backend Database Migrations

ShAIRR uses Alembic for database schema migrations.

Create a new migration:

```bash
alembic revision --autogenerate -m "description of change"
```

Apply all pending migrations:

```bash
alembic upgrade head
```

Roll back the most recent migration:

```bash
alembic downgrade -1
```

---

## Project Structure

```text
.
├── .env                        # Environment variables (already configured for development)
├── docker-compose.yml          # Default Docker Compose configuration
├── docker-compose.dev.yml      # Development Docker Compose configuration
├── LICENSE
├── README.md
├── backend/                    # ShAIRR Backend API service
│   ├── Dockerfile
│   ├── alembic.ini             # Alembic migration configuration
│   ├── main.py                 # Application entry point
│   ├── requirements.txt
│   ├── alembic/                # Migration scripts
│   ├── core/                   # Core utilities, configuration, security
│   ├── routes/                 # API route definitions
│   ├── schemas/                # Pydantic models
│   └── services/               # Business logic
├── frontend/                   # ShAIRR Frontend application
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── angular.json
│   ├── package.json
│   ├── src/
│   │   ├── app/                # Angular modules
│   │   ├── assets/             # Static assets
│   │   └── scss/               # Stylesheets
│   └── nginx.conf              # Nginx configuration
└── keycloak/                   # Keycloak identity provider
    └── import/                 # Realm import configuration
```

## Deploying over a reverse proxy (or subpath)

ShAIRR can also be deployed over an existing HTTP server such as Apache. The configuration below shows an example of an Apache reverse proxy which correctly redirect each request to their appropriate hostname, and configure's ShAIRR to be available in a different subpath.
These configuration will depend on the server's configuration and need to be manually configured. Take special care with keycloak's "HOST":

```
# Keycloak
<Location /auth>
    ProxyPass http://keycloak:8080/auth retry=0
    ProxyPassReverse http://keycloak:8080/auth
    UseCanonicalName On
    RequestHeader set "Host" "yourserver.com" # Needs to match your domain
    RequestHeader set "X-Forwarded-Proto" expr=%{REQUEST_SCHEME}
    RequestHeader set "X-Forwarded-SSL" expr=%{HTTPS}
</Location>

# ShAIRR
## File management websocket
ProxyPass /shairr-backend/ws/ ws://shairr-backend:8000/ws/
ProxyPassReverse /shairr-backend/ws/ ws://shairr-backend:8000/ws/

# Backend
ProxyPass /shairr-backend/ http://shairr-backend:8000/
ProxyPassReverse /shairr-backend/ http://shairr-backend:8000/

# Frontend
ProxyPass /shairr/ http://shairr-frontend:80/
ProxyPassReverse /shairr/ http://shairr-frontend:80/
```
