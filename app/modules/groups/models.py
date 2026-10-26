from sqlalchemy import Column, ForeignKey, Table, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base


group_tags = Table(
    "group_tags",
    Base.metadata,
    Column("group_id", ForeignKey("groups.id"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id"), primary_key=True),
)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    tags = relationship(
        "Tag",
        secondary=group_tags,
        back_populates="groups",
    )