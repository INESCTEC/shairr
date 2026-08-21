"""add_id_task_to_dataset

Revision ID: 3bd6d6fa76f0
Revises: 645758b085a0
Create Date: 2026-05-29 11:31:17.707513

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3bd6d6fa76f0'
down_revision: Union[str, Sequence[str], None] = '645758b085a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('dataset') as batch_op:
        batch_op.add_column(sa.Column('id_task', sa.Integer(), nullable=True))

        batch_op.create_foreign_key(
            'fk_dataset_task',
            'task',
            ['id_task'],
            ['id'],
            ondelete='SET NULL'
        )

def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('dataset') as batch_op:
        batch_op.drop_constraint('fk_dataset_task', type_='foreignkey')
        batch_op.drop_column('id_task')