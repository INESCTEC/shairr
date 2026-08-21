"""study public toggle

Revision ID: ffda2cd0e8db
Revises: b8dc3e9870a5
Create Date: 2026-05-26 14:49:26.246429

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'ffda2cd0e8db'
down_revision: Union[str, Sequence[str], None] = 'f26613d3dd97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    
    # Check if column already exists
    result = connection.execute(text("PRAGMA table_info(study)")).fetchall()
    column_exists = any(column[1] == 'public' for column in result)
    
    if not column_exists:
        # Add column only if it doesn't exist
        op.add_column('study', sa.Column('public', sa.Boolean(), nullable=True, comment='Whether the study is publicly available'))
        
        # Set all existing rows to FALSE
        op.execute(text("UPDATE study SET public = 0 WHERE public IS NULL"))
        
        # For SQLite, use batch_alter_table for default
        with op.batch_alter_table('study') as batch_op:
            batch_op.alter_column('public', server_default=sa.text('0'))


def downgrade() -> None:
    """Downgrade schema."""
    connection = op.get_bind()
    result = connection.execute(text("PRAGMA table_info(study)")).fetchall()
    column_exists = any(column[1] == 'public' for column in result)
    
    if column_exists:
        op.drop_column('study', 'public')