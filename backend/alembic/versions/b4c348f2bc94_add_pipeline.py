"""add pipeline

Revision ID: b4c348f2bc94
Revises: ac57d67899ca
Create Date: 2026-05-18 17:45:21.325132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4c348f2bc94'
down_revision: Union[str, Sequence[str], None] = 'ac57d67899ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create pipeline table
    op.create_table('pipeline',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        comment='Defines a sequence of Tool Actions to form a processing pipeline.'
    )
    op.create_index('ix_pipeline_id', 'pipeline', ['id'], unique=False)
    
    # Add pipeline_id to pipeline_configuration if it doesn't exist
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'pipeline_configuration' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('pipeline_configuration')]
        
        if 'pipeline_id' not in columns:
            op.add_column('pipeline_configuration', sa.Column('pipeline_id', sa.Integer(), nullable=True))
            op.create_foreign_key(
                'fk_pipeline_configuration_pipeline',
                'pipeline_configuration',
                'pipeline',
                ['pipeline_id'],
                ['id'],
                ondelete='CASCADE'
            )
            op.create_index('ix_pipeline_configuration_pipeline_id', 'pipeline_configuration', ['pipeline_id'], unique=False)


def downgrade() -> None:
    # Remove foreign key and column
    try:
        op.drop_constraint('fk_pipeline_configuration_pipeline', 'pipeline_configuration', type_='foreignkey')
    except:
        pass
    
    try:
        op.drop_index('ix_pipeline_configuration_pipeline_id', table_name='pipeline_configuration')
    except:
        pass
    
    try:
        op.drop_column('pipeline_configuration', 'pipeline_id')
    except:
        pass
    
    # Drop pipeline table
    op.drop_index('ix_pipeline_id', table_name='pipeline')
    op.drop_table('pipeline')