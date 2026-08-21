from datetime import datetime
import os
import os.path
import logging
import subprocess
from typing import Annotated

from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks

from core.Auth import OidcWorkflow
from core.Files import Files
from schemas.dao.Task import TaskRepository
from schemas.dao.Tool import ToolRepository
from schemas.db import Tool
from schemas.json.Task import TaskCreatedResponse, TaskCreate
from schemas.json.Tool import ToolResponse, ToolInstall, ToolCreate, ToolWithPropsResponse
from schemas.json.User import UserData
from services.NextflowService import NextflowService

logger = logging.getLogger(__name__)

router = APIRouter()


def check_docker_image_exists(image_name: str = "immunarch:latest") -> bool:
    """Check if a Docker image exists locally"""
    try:
        result = subprocess.run(
            ['docker', 'image', 'inspect', image_name],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        logger.warning(f"Timeout checking for Docker image {image_name}")
        return False
    except Exception as e:
        logger.error(f"Error checking Docker image {image_name}: {e}")
        return False


def sync_tool_installation_status(tool_id: int) -> bool:
    """Sync the tool's installed flag with actual Docker image existence"""
    tool = ToolRepository.get(tool_id)
    if not tool:
        return False
    
    # Check if Docker image actually exists
    image_exists = check_docker_image_exists()
    
    # If database says installed but image doesn't exist, reset the flag
    if tool.installed and not image_exists:
        logger.warning(f"Tool '{tool.name}' (ID: {tool_id}) marked as installed but Docker image not found. Resetting installed flag.")
        ToolRepository.update(tool_id, {'installed': False})
        return False
    
    # If image exists but database says not installed, update the flag
    if not tool.installed and image_exists:
        logger.info(f"Tool '{tool.name}' (ID: {tool_id}) Docker image exists but database says not installed. Updating flag.")
        ToolRepository.update(tool_id, {'installed': True})
        return True
    
    return tool.installed


@router.get("/tool/immunarch/check")
def check_immunarch(
    user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)]
):
    """Check if ImmunArch is installed and sync with database"""
    # Try exact match first
    immunarch_tool = ToolRepository.get_by_name("immunarch")
    
    # If not found, try searching
    if not immunarch_tool:
        tools = ToolRepository.search_by_name("immunarch", limit=1, page=1)
        immunarch_tool = tools[0] if tools else None
    
    if not immunarch_tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ImmunArch tool not found in database"
        )
    
    # Sync the installation status with Docker
    is_installed = sync_tool_installation_status(immunarch_tool.id)
    
    # Get fresh tool data after sync
    immunarch_tool = ToolRepository.get(immunarch_tool.id)
    
    return {
        "installed": is_installed,
        "tool_id": immunarch_tool.id,
        "tool_name": immunarch_tool.name,
        "db_installed": immunarch_tool.installed,
        "status": "installed" if is_installed else "not_installed"
    }

@router.get(
    "/tool",
    description="Returns a list of possible tools that can be executed.",
)
async def get_tools(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    limit: int = 10,
    page: int = 1,
    search: str = ""
) -> list[ToolResponse]:
    tools: list[Tool] = ToolRepository.get_all(limit, page, search)
    
    # Sync each tool's status with Docker
    for tool in tools:
        sync_tool_installation_status(tool.id)
    
    # Refresh the tool data after sync
    tools = ToolRepository.get_all(limit, page, search)
    
    return [ToolResponse.model_validate(tool) for tool in tools]


@router.get(
    "/tool/{id_tool}",
    description="Get specific tool by id"
)
def get_tool(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_tool: int,
) -> ToolWithPropsResponse:
    # Sync status before returning
    sync_tool_installation_status(id_tool)
    
    tool: Tool = ToolRepository.get(id_tool)

    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    try:
        script_path = Files.format_action_scripts_path(tool.install_script)
        if script_path and os.path.exists(script_path):
            script_code = Files.get_file_contents(script_path)
            tool.install_script = script_code
        else:
            tool.install_script = ""
    except Exception as e:
        logger.warning(
            f"Could not read install script for tool {id_tool}: {e}")
        tool.install_script = ""

    return ToolWithPropsResponse.model_validate(tool)


@router.get(
    "/tool/{id_tool}/status",
    description="Check the actual installation status of a tool by verifying Docker image exists"
)
def check_tool_status(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_tool: int,
):
    """Returns the actual installation status by checking Docker"""
    tool = ToolRepository.get(id_tool)
    
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check Docker for the image
    docker_image_exists = check_docker_image_exists()
    
    # Sync database with reality
    currently_installed = sync_tool_installation_status(id_tool)
    
    return {
        "id": tool.id,
        "name": tool.name,
        "db_installed": tool.installed,
        "docker_image_exists": docker_image_exists,
        "actually_installed": currently_installed,
        "needs_installation": not currently_installed
    }


@router.post(
    "/tool",
    description="Create a new tool",
    status_code=status.HTTP_201_CREATED
)
def create_tool(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    tool: ToolCreate
) -> ToolResponse:
    script_path = ToolRepository.add_install_script_file(tool)
    try:
        created = ToolRepository.create_from_pydantic(tool)
        return ToolResponse.model_validate(created)
    except Exception as e:
        # delete the installation script in case the installation fails
        if os.path.exists(script_path):
            os.remove(script_path)
        logger.error(f"Failed to create tool: {e}")
        raise e


@router.patch(
    "/tool/{id_tool}",
    description="Update an existing tool",
    status_code=status.HTTP_200_OK,
    response_model=ToolResponse
)
def update_tool(
        _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
        id_tool: int,
    tool_update: ToolCreate,
) -> ToolResponse:
    # Check if tool exists
    existing_tool = ToolRepository.get(id_tool)
    if not existing_tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {id_tool} not found"
        )

    # Handle installation script
    script_path = ToolRepository.add_install_script_file(tool_update)

    try:
        # Update tool with provided fields
        updated_tool = ToolRepository.update(id_tool, tool_update)
        return ToolResponse.model_validate(updated_tool)
    except Exception as e:
        # Clean up script file on failure
        if os.path.exists(script_path):
            os.remove(script_path)
        logger.error(f"Failed to update tool {id_tool}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update tool: {str(e)}"
        )


@router.post(
    "/tool/{id_tool}/install",
    description="Queues a tool for installation. If 'force' is provided as 'true' "
                "an installation process will be queued even if tool is already installed",
    status_code=status.HTTP_201_CREATED
)
def install_tool(
        user: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
        id_tool: int,
        background_tasks: BackgroundTasks,
        tool_install: ToolInstall
) -> TaskCreatedResponse:
    # Get the tool from database
    tool = ToolRepository.get(id_tool)

    # Check if tool exists
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool with ID {id_tool} not found"
        )
    
    # Sync the installation status with Docker before proceeding
    is_actually_installed = sync_tool_installation_status(id_tool)
    
    # Refresh tool data after sync
    tool = ToolRepository.get(id_tool)

    # Check if tool is actually installed (not just database flag)
    if is_actually_installed and not tool_install.force:
        raise HTTPException(
            status_code=status.HTTP_200_OK,
            detail=f"Tool '{tool.name}' is already installed (Docker image found)"
        )

    # Validate installation script exists in database
    if not tool.install_script:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Tool '{tool.name}' does not have an installation script defined in the database"
        )

    # Check if the script file actually exists
    script_path = Files.format_action_scripts_path(tool.install_script)

    if not script_path:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Could not resolve script path for tool '{tool.name}'"
        )

    if not os.path.isfile(script_path):
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"Installation script '{tool.install_script}' not found at path: {script_path}"
        )

    # Create installation task
    task_name = f"Tool Install - {tool.name}"
    task = TaskRepository.create_from_pydantic(
        TaskCreate(name=task_name, id_user=user.id))

    if not task:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create installation task"
        )

    # Queue the installation task
    background_tasks.add_task(NextflowService.install_tool, user, tool, task)

    logger.debug(f"Queued installation for tool '{tool.name}' (ID: {id_tool}) - Task ID: {task.id}")

    return task


@router.delete(
    "/tool/{id_tool}",
    description="Delete existing tool",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_tool(
    _: Annotated[UserData, Depends(OidcWorkflow.get_userinfo)],
    id_tool: int
):
    tool = ToolRepository.get(id_tool)
    if not tool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    try:
        script_path = Files.format_action_scripts_path(tool.install_script)
        if script_path and os.path.exists(script_path):
            os.remove(script_path)
    except Exception as e:
        logger.warning(f"Could not delete script for tool {id_tool}: {e}")

    if not ToolRepository.remove(id_tool):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)