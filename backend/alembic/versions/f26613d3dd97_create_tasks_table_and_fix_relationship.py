"""create_tasks_table_and_fix_relationship

Revision ID: f26613d3dd97
Revises: 3b7ccd2db9b6
Create Date: 2026-05-18 17:14:51.551284

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f26613d3dd97'
down_revision: Union[str, Sequence[str], None] = '3b7ccd2db9b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Create task table
    op.create_table('task',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('id_process', sa.Integer(), nullable=True),
        sa.Column('id_action', sa.Integer(), nullable=True),
        sa.Column('id_pipeline_step', sa.Integer(), nullable=True),
        sa.Column('id_pipeline_config', sa.Integer(), nullable=True),
        sa.Column('id_user', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('time_start', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('time_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='RUNNING'),
        sa.Column('inputs', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('output_path', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        comment='Stores execution tasks'
    )
    
    op.create_index(op.f('ix_task_id'), 'task', ['id'], unique=False)
    op.create_index(op.f('ix_task_id_user'), 'task', ['id_user'], unique=False)
    
    # Use batch mode to add foreign key to dataset table
    with op.batch_alter_table('dataset') as batch_op:
        # Add id_task column if it doesn't exist
        batch_op.add_column(sa.Column('id_task', sa.Integer(), nullable=True))
        # Add foreign key constraint
        batch_op.create_foreign_key(
            'fk_dataset_task',
            'task',
            ['id_task'],
            ['id'],
            ondelete='CASCADE'
        )
        # Create index
        batch_op.create_index('ix_dataset_id_task', ['id_task'], unique=False)


def downgrade():
    # Remove foreign key and column using batch mode
    with op.batch_alter_table('dataset') as batch_op:
        batch_op.drop_index('ix_dataset_id_task')
        batch_op.drop_constraint('fk_dataset_task', type_='foreignkey')
        batch_op.drop_column('id_task')
    
    # Drop task table
    op.drop_index(op.f('ix_task_id_user'), table_name='task')
    op.drop_index(op.f('ix_task_id'), table_name='task')
    op.drop_table('task')