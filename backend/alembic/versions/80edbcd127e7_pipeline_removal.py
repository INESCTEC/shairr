"""pipeline removal

Revision ID: 80edbcd127e7
Revises: b4c348f2bc94
Create Date: 2026-05-18 19:37:39.918414

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision: str = '80edbcd127e7'
down_revision: Union[str, Sequence[str], None] = 'b4c348f2bc94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Get connection and inspector to check existing objects
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    
    # Drop pipeline table and its index if they exist
    if 'pipeline' in inspector.get_table_names():
        # Check if index exists before dropping
        indexes = inspector.get_indexes('pipeline')
        index_names = [idx['name'] for idx in indexes]
        
        if 'ix_pipeline_id' in index_names:
            op.drop_index('ix_pipeline_id', table_name='pipeline')
        else:
            print("Index ix_pipeline_id not found, skipping")
        
        # Drop the table
        op.drop_table('pipeline')
    else:
        print("Table pipeline not found, skipping")
    
    # Drop indexes on dataset and task if they exist
    if 'dataset' in inspector.get_table_names():
        indexes = inspector.get_indexes('dataset')
        index_names = [idx['name'] for idx in indexes]
        
        if 'ix_dataset_id_task' in index_names:
            op.drop_index('ix_dataset_id_task', table_name='dataset')
        else:
            print("Index ix_dataset_id_task not found, skipping")
    
    if 'task' in inspector.get_table_names():
        indexes = inspector.get_indexes('task')
        index_names = [idx['name'] for idx in indexes]
        
        if 'ix_task_id_user' in index_names:
            op.drop_index('ix_task_id_user', table_name='task')
        else:
            print("Index ix_task_id_user not found, skipping")
        
        # Modify task table using batch mode
        with op.batch_alter_table('task') as batch_op:
            # Add foreign key constraints
            batch_op.create_foreign_key('fk_task_action', 'action', ['id_action'], ['id'], ondelete='CASCADE')
            batch_op.create_foreign_key('fk_task_user', 'user', ['id_user'], ['id'], ondelete='CASCADE')
            
            # Drop columns
            batch_op.drop_column('id_pipeline_step')
            batch_op.drop_column('id_pipeline_config')
    else:
        print("Table task not found, skipping")


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    
    # Re-add columns first
    if 'task' in inspector.get_table_names():
        with op.batch_alter_table('task') as batch_op:
            # Remove foreign key constraints
            try:
                batch_op.drop_constraint('fk_task_action', type_='foreignkey')
                batch_op.drop_constraint('fk_task_user', type_='foreignkey')
            except:
                print("Foreign keys not found, skipping")
            
            # Re-add columns
            batch_op.add_column(sa.Column('id_pipeline_config', sa.INTEGER(), nullable=True))
            batch_op.add_column(sa.Column('id_pipeline_step', sa.INTEGER(), nullable=True))
        
        # Re-create indexes
        op.create_index('ix_task_id_user', 'task', ['id_user'], unique=False)
    
    # Re-create dataset index
    if 'dataset' in inspector.get_table_names():
        op.create_index('ix_dataset_id_task', 'dataset', ['id_task'], unique=False)
    
    # Re-create pipeline table
    if 'pipeline' not in inspector.get_table_names():
        op.create_table('pipeline',
            sa.Column('id', sa.INTEGER(), nullable=False),
            sa.Column('name', sa.VARCHAR(), nullable=True),
            sa.Column('description', sa.VARCHAR(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_pipeline_id', 'pipeline', ['id'], unique=False)