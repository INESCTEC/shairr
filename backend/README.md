# ShAIRR Backend API

A microservice to manage ShAIRR.

## Requirements
- Python (3.13+)
- Project's dependencies defined in [`requirements.txt`](./requirements.txt)

## Development environment setup
- Install `python3` (3.13+ required) along with `pip3`

- Create and run a Python virtual environment (optional but recommended)
```sh
python3 -m venv venv
source venv/bin/activate
```

- On the project's root directory, make a copy of `.env.example ` and rename it to `.env`
- Update the contents of `.env` to match the environment you're running on.
    - Generally, you need a client secret of your own for encription services. You may randomly generate this string online.
    - We provide a default authentication service powered by Keycloak. To replace this with your own use `auth.url`, `auth.realm`, and `auth.client_id`.

- Install project's dependencies
```sh
pip3 install -r requirements.txt
```

- Run the project
```sh
python3 main.py
```

### Updating the database

This project uses Alembic (SQLAlchemy’s migration tool) to evolve the database schema safely over time. You’ll create migrations when models change, then apply them to keep every environment (dev/CI/prod) in sync.
`alembic upgrade head`

#### Creating migrations

There are two ways to create a migration file.

##### A) Autogenerate (diffs from models) 

If your models reflect the current desired schema, let Alembic compare the DB to your models and scaffold a migration:

`alembic revision --autogenerate -m "describe your change"`

Then review the generated file in alembic/versions/ and adjust if needed.

##### B) Empty migration (from scratch)

If you prefer full control:

`alembic revision -m "describe your change"`

Edit the new file and implement upgrade() / downgrade() manually.

#### Applying migrations

Upgrade the database to the latest revision:

`alembic upgrade head`


Upgrade step-by-step (useful for debugging):

`alembic upgrade +1`


Downgrade (roll back) one step:

`alembic downgrade -1`


Downgrade to a specific revision:

`alembic downgrade <revision_id>`

## Running in WSL2

WSL2 supports the same PPA as ubuntu. You can simple use:

```sh
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install python3.12-full -y
```

Then you can use:

```sh
python3.12 -m venv venv
source .venv/bin/activate
pip3.12 install -r requirements.txt
```

## Integrations

## Deployment

This service may be deployed using [Docker](https://docs.docker.com) and [Docker Compose](https://docs.docker.com/compose), based on the [Dockerfile](./Dockerfile) and [docker-compose.yml](./docker-compose.yml).

It still requires backend configuration.

- On the project's root directory, make a copy of `.env.example ` and rename it to `.env`
- Update the contents of `.env` to match the environment you're running on.
    - Generally, you need a client secret of your own for encription services. You may randomly generate this string online.
    - We provide a default authentication service powered by Keycloak. To replace this with your own use `auth.url`, `auth.realm`, and `auth.client_id`.

```
# From the backend root folder:
docker compose up
```


## Configurations
All configuration options available in [`core/Config.py`](./core/Config.py) may be overriden in the [`.env`](./.env) file located in the project's root directory.