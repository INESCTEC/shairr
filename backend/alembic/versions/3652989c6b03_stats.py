"""stats

Revision ID: 3652989c6b03
Revises: 860ef7a4c365
Create Date: 2026-05-20 18:57:43.310907

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '3652989c6b03'
down_revision: Union[str, Sequence[str], None] = '860ef7a4c365'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('dataset')] if 'dataset' in existing_tables else []
    existing_foreign_keys = [fk['name'] for fk in inspector.get_foreign_keys('dataset')] if 'dataset' in existing_tables else []
    
    # Create tool table if it doesn't exist
    if 'tool' not in existing_tables:
        op.create_table('tool',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=True),
            sa.Column('install_script', sa.String(), nullable=True),
            sa.Column('installed', sa.Boolean(), nullable=True),
            sa.Column('environment_variables', sa.String(), nullable=True),
            sa.Column('active', sa.Boolean(), nullable=False),
            sa.Column('properties', sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('name')
        )
        op.create_index(op.f('ix_tool_id'), 'tool', ['id'], unique=False)
    
    # Create action table if it doesn't exist
    if 'action' not in existing_tables:
        op.create_table('action',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(), nullable=True),
            sa.Column('name_friendly', sa.String(), nullable=True),
            sa.Column('description', sa.String(), nullable=True),
            sa.Column('codename', sa.String(), nullable=True),
            sa.Column('script', sa.String(), nullable=True),
            sa.Column('id_tool', sa.Integer(), nullable=True),
            sa.Column('type', sa.Enum('GENERATOR', 'PREDICTION', 'SIMULATION', 'PREPROCESSING', 'STATISTICS', name='actiontype'), nullable=True),
            sa.ForeignKeyConstraint(['id_tool'], ['tool.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('codename'),
            comment='Defines a specific action or feature that a software "Tool" can execute.'
        )
        op.create_index(op.f('ix_action_id'), 'action', ['id'], unique=False)

    
    # Create stats_cache table if it doesn't exist
    if 'stats_cache' not in existing_tables:
        op.create_table('stats_cache',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('id_input_dataset', sa.Integer(), nullable=True),
            sa.Column('type', sa.Enum('GENE_USAGE', 'REPERTOIRE_OVERLAP', 'NUMBER_CLONOTYPES', 'DISTRO_CLONOTYPES', 'CDR3_LEN', 'TOP_CLONES', 'TRACK_CLONOTYPES', 'CLONAL_PROPORTION', 'DIVERSITY', 'CLONAL_NETWORKS', 'PHYLO_TREES', name='statstype'), nullable=False),
            sa.Column('id_result_dataset', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['id_input_dataset'], ['dataset.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['id_result_dataset'], ['dataset.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_stats_cache_id'), 'stats_cache', ['id'], unique=False)
    
    # Create index on dataset only if it doesn't exist
    if 'dataset' in existing_tables and 'ix_dataset_id' not in existing_indexes:
        op.create_index(op.f('ix_dataset_id'), 'dataset', ['id'], unique=False)
    
    # Use batch mode for dataset table modifications
    with op.batch_alter_table('dataset') as batch_op:
        # Add foreign key with a name
        if 'fk_dataset_id_group' not in existing_foreign_keys:
            batch_op.create_foreign_key('fk_dataset_id_group', 'dataset_group', ['id_group'], ['id'])
        # Drop column if it exists
        batch_op.drop_column('id_task')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('dataset') as batch_op:
        batch_op.add_column(sa.Column('id_task', sa.INTEGER(), nullable=True))
        batch_op.drop_constraint('fk_dataset_id_group', type_='foreignkey')
    
    op.drop_index(op.f('ix_dataset_id'), table_name='dataset')
    op.drop_index(op.f('ix_stats_cache_id'), table_name='stats_cache')
    op.drop_table('stats_cache')
    op.drop_table('nf_output')
    op.drop_table('nf_input')
    op.drop_index(op.f('ix_action_id'), table_name='action')
    op.drop_table('action')
    op.drop_index(op.f('ix_tool_id'), table_name='tool')
    op.drop_table('tool')