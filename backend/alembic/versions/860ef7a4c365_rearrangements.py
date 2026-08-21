"""rearrangements

Revision ID: 860ef7a4c365
Revises: 80edbcd127e7
Create Date: 2026-05-20 17:06:00.487429

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '860ef7a4c365'
down_revision: Union[str, Sequence[str], None] = '80edbcd127e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Just create the new rearrangement table - don't touch dataset
    op.create_table('rearrangement',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('id_user', sa.Integer(), nullable=False),
        sa.Column('id_task', sa.Integer(), nullable=True),
        sa.Column('id_sample', sa.Integer(), nullable=True),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('filepath', sa.String(), nullable=True),
        sa.Column('filesize', sa.Float(), nullable=True),
        sa.Column('time_created', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('type', sa.Enum('ANTIGEN', 'REPERTOIRE', 'REPORT', 'SUBSET', name='datatype'), nullable=False),
        sa.Column('properties', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['id_sample'], ['sample.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['id_task'], ['task.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['id_user'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rearrangement_id'), 'rearrangement', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_rearrangement_id'), table_name='rearrangement')
    op.drop_table('rearrangement')