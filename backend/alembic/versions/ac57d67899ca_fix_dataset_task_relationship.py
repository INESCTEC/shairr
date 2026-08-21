"""fix_dataset_task_relationship

Revision ID: ac57d67899ca
Revises: f26613d3dd97
Create Date: 2026-05-18 17:26:25.482687

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ac57d67899ca'
down_revision: Union[str, Sequence[str], None] = 'f26613d3dd97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # SQLite requires turning off foreign keys to modify tables
    op.execute('PRAGMA foreign_keys=OFF')
    
    # Create new dataset table with proper foreign key
    op.create_table(
        'dataset_new',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('filepath', sa.String(), nullable=True),
        sa.Column('filesize', sa.Float(), nullable=True),
        sa.Column('line_count', sa.Integer(), nullable=True),
        sa.Column('time_created', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('annotated', sa.Boolean(), nullable=True),
        sa.Column('id_group', sa.Integer(), nullable=True),
        sa.Column('id_task', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['id_group'], ['dataset_group.id'], ),
        sa.ForeignKeyConstraint(['id_task'], ['task.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Copy data from old dataset table
    op.execute('INSERT INTO dataset_new (id, filename, filepath, filesize, line_count, time_created, annotated, id_group, id_task) SELECT id, filename, filepath, filesize, line_count, time_created, annotated, id_group, id_task FROM dataset')
    
    # Drop old table and rename new one
    op.drop_table('dataset')
    op.rename_table('dataset_new', 'dataset')
    
    # Recreate indexes
    op.create_index('ix_dataset_id', 'dataset', ['id'], unique=False)
    op.create_index('ix_dataset_id_task', 'dataset', ['id_task'], unique=False)
    
    # Turn foreign keys back on
    op.execute('PRAGMA foreign_keys=ON')

def downgrade():
    op.execute('PRAGMA foreign_keys=OFF')
    
    op.create_table(
        'dataset_old',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('filepath', sa.String(), nullable=True),
        sa.Column('filesize', sa.Float(), nullable=True),
        sa.Column('line_count', sa.Integer(), nullable=True),
        sa.Column('time_created', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('annotated', sa.Boolean(), nullable=True),
        sa.Column('id_group', sa.Integer(), nullable=True),
        sa.Column('id_task', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    op.execute('INSERT INTO dataset_old SELECT id, filename, filepath, filesize, line_count, time_created, annotated, id_group, id_task FROM dataset')
    op.drop_table('dataset')
    op.rename_table('dataset_old', 'dataset')
    
    op.execute('PRAGMA foreign_keys=ON')