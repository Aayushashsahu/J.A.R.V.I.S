"""add_relationship_memory_columns

Revision ID: cb065ea4b195
Revises: 2c1bea6fea5f
Create Date: 2026-06-18 17:59:03.131973

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb065ea4b195'
down_revision: Union[str, Sequence[str], None] = '2c1bea6fea5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
