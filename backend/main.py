import logging
from contextlib import asynccontextmanager

import uvicorn
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware

from core.Config import config
from core.Plugins import load_plugins
from routes import router
from schemas import db  # noqa


logger = logging.getLogger(__name__)

def make_middleware() -> list[Middleware]:
    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
            allow_credentials=True
        )
        # Middleware(
        #    AuthenticationMiddleware,
        #    backend=AuthBackend(),
        #    on_error=on_auth_error,
        # ),
    ]

    return middleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    #try:
    #    DockerService.assert_docker_health()
    #    logger.info("Successful access to Docker and Docker compose ")

    #except Exception as e:
    #    logger.error(
    #        f"Docker or Docker Compose are not available. The application will be unable to launch integrations that depend on Docker. {e}")

    logger.info("Running alembic migrations")
    alembic_cfg = Config("alembic.ini")

    # prevent Alembic from reconfiguring logging (requires env.py guard below)
    alembic_cfg.attributes["configure_logger"] = False
    alembic_cfg.set_main_option("sqlalchemy.url", config.db_path)

    try:
        command.upgrade(alembic_cfg, "head")
    except Exception:
        logger.exception("Alembic migration failed")
        raise

    yield

def create_runtime() -> FastAPI:
    runtime = FastAPI(
        title="ShAIRR API",
        description="Backend system for interacting with ShAIRR",
        version="1.0.0",
        # dependencies=[Depends(Logging)],
        middleware=make_middleware(),
        root_path=config.root_path,
        lifespan=lifespan,
        swagger_ui_init_oauth = {
            "clientId": config.auth.client_id,
            "clientSecret": config.auth.client_secret
        }
    )

    load_plugins(runtime)

    runtime.include_router(router)

    return runtime


app = create_runtime()


def main():
    uvicorn.run(
        app="main:app",
        reload=True,
        host='0.0.0.0',
        log_config="log_conf.yaml",
        port=config.port,
        reload_includes=["*.py"],
        reload_excludes=[
            "data/*", "venv/*", ".git/*", "__pycache__/*", ".mypy_cache/*", ".pytest_cache/*", "node_modules/*",
            "alembic/*"
        ]
    )

if __name__ == "__main__":
    main()