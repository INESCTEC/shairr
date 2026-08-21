import logging
import sys
from importlib import import_module
from importlib.metadata import entry_points
from pathlib import Path

logger = logging.getLogger(__name__)


def load_entrypoint_plugins(app):
    for entry_point in entry_points(group="shairr.plugins"):
        try:
            module = entry_point.load()

            router = getattr(module, "router", None)

            if router is not None:
                app.include_router(router)

            logger.info(
                "Loaded entrypoint plugin '%s'",
                entry_point.name
            )
        except Exception:
            logger.exception(
                "Failed to load entrypoint plugin '%s'",
                entry_point.name
            )


def load_directory_plugins(app):
    plugin_directory = Path("plugins")

    if not plugin_directory.exists():
        return

    sys.path.insert(0, str(plugin_directory.resolve()))

    for plugin_path in plugin_directory.iterdir():
        if not plugin_path.is_dir():
            continue

        try:
            module = import_module(plugin_path.name)

            router = getattr(module, "router", None)

            if router is not None:
                app.include_router(router)

            logger.info(
                "Loaded directory plugin '%s'",
                plugin_path.name
            )
        except Exception:
            logger.exception(
                "Failed to load directory plugin '%s'",
                plugin_path.name
            )


def load_plugins(app):
    load_entrypoint_plugins(app)
    load_directory_plugins(app)