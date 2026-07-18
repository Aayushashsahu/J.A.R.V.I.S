"""add_agent_runs_table

Revision ID: d31a5eb2419f
Revises: cb065ea4b195
Create Date: 2026-06-23 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd31a5eb2419f'
down_revision: Union[str, Sequence[str], None] = 'cb065ea4b195'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'agent_runs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('goal', sa.Text(), nullable=False),
        sa.Column('trace_json', sa.Text(), nullable=False),
        sa.Column('final_answer', sa.Text(), nullable=True),
        sa.Column('sources_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('agent_runs')
