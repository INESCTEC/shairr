"""merge_heads

Revision ID: 645758b085a0
Revises: efc49fe6d5e5, ffda2cd0e8db
Create Date: 2026-05-29 11:09:38.446835

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '645758b085a0'
down_revision: Union[str, Sequence[str], None] = ('efc49fe6d5e5', 'ffda2cd0e8db')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
