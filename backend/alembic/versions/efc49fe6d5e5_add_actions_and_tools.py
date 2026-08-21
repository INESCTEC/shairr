"""add_actions_and_tools

Revision ID: efc49fe6d5e5
Revises: 3652989c6b03
Create Date: 2026-05-20 19:41:02.454879

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'efc49fe6d5e5'
down_revision: Union[str, Sequence[str], None] = '3652989c6b03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert tools first
    op.execute("""
        INSERT INTO "tool" ("name", "install_script", "installed", "environment_variables", "active", "properties") 
        VALUES ('R-Immunarch', 'r-immunarch-install.nf', 1, NULL, 1, NULL)
    """)
    
    # Insert actions
    op.execute("""
        INSERT INTO "action" ("name", "name_friendly", "description", "codename", "script", "id_tool", "type") VALUES 
            ('Compute stats using immunarch', 'compute stats', NULL, 'r-immunarch-compute-stats', 'r-immunarch-compute-stats.nf', 1, 'STATISTICS')
    """)


def downgrade() -> None:
    op.execute("DELETE FROM action WHERE id BETWEEN 1 AND 14")
    op.execute("DELETE FROM tool WHERE id BETWEEN 1 AND 10")