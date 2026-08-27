import logging
import os

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class AuthConfig(BaseModel):
    url: str
    realm: str
    client_id: str
    client_secret: str

class Config(BaseSettings):
    """
    API's configuration options.
    Options present in this file may be overriden in the .env file located
    in the project's root directory.

    Configuration's settings are based on the pydantic model:
    https://docs.pydantic.dev/latest/usage/settings/
    """
    auth: AuthConfig

    db_path: str = "sqlite:///data/database/main.db"

    # Temporary location where uploads will be stored
    uploads_path: str = "data/uploads"

    # Temporary location where uploads will be stored
    downloads_path: str = "data/downloads"

    # Location for actual datasets present in the database
    dataset_path: str = "data/datasets"

    # Temporary location where AIRR uploads will be stored before being sent to the AIRR repository
    airr_transfers_path: str = "data/airr"

    jwt_algorithm: str = "HS256"

    jwt_secret: str

    hash_salt: str

    # Session file size quota in megabytes.
    # Maximum amount of disk space in megabytes that session can use.
    file_quota: int = 1000

    root_path: str = ""

    repertoire_separator: str = "|"

    model_config = SettingsConfigDict(env_file='./.env', env_nested_delimiter='.', extra="ignore")

    max_tasks_session: int = 5

    # Location for tasks outputs
    tasks_path: str = "data/tasks"

    docker: bool = False

    port: int = 8000

    # Root directory shared by API and worker containers.
    # Point this to an external shared folder (for example an NFS mount).
    shared_data_root: str = "/app/data"

    def model_post_init(self, __context) -> None:
        root = self.shared_data_root.rstrip("/")

        if self.docker:
            self.uploads_path = os.path.join(root, "uploads")
            self.downloads_path = os.path.join(root, "downloads")
            self.dataset_path = os.path.join(root, "datasets")
            self.tasks_path = os.path.join(root, "tasks")
            database_file = os.path.join(root, "database", "main.db")
            self.db_path = f"sqlite:///{database_file}"

        logger.debug(self.dataset_path)

config: Config = Config()