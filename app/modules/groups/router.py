from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.infrastructure.database import get_db
from app.modules.groups.models import Group
from app.modules.tags.models import Tag
from app.modules.users.models import User
from app.modules.groups.schemas import (
    GroupCreate,
    GroupUpdate,
    GroupResponse,
    UserInGroup,
)

router = APIRouter(
    prefix="/groups",
    tags=["Groups"],
)


@router.post(
    "/",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_group(
    group_data: GroupCreate,
    db: Session = Depends(get_db),
):
    tags = db.scalars(
        select(Tag).where(Tag.id.in_(group_data.tag_ids))
    ).all()

    if len(tags) != len(set(group_data.tag_ids)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more tags not found",
        )

    group = Group(
        name=group_data.name,
        description=group_data.description,
        tags=tags,
    )

    db.add(group)

    try:
        db.commit()
        db.refresh(group)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Group with this name already exists",
        )

    return group


@router.get("/", response_model=list[GroupResponse])
def get_groups(db: Session = Depends(get_db)):
    statement = (
        select(Group)
        .options(selectinload(Group.tags))
        .order_by(Group.id)
    )

    return db.scalars(statement).all()


@router.patch("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: int,
    group_data: GroupUpdate,
    db: Session = Depends(get_db),
):
    group = db.get(Group, group_id)

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    update_data = group_data.model_dump(exclude_unset=True)

    if "tag_ids" in update_data:
        tag_ids = update_data.pop("tag_ids") or []
        tags = db.scalars(
            select(Tag).where(Tag.id.in_(tag_ids))
        ).all()

        if len(tags) != len(set(tag_ids)):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more tags not found",
            )

        group.tags = tags

    if update_data.get("name") is None:
        update_data.pop("name", None)

    for field, value in update_data.items():
        setattr(group, field, value)

    try:
        db.commit()
        db.refresh(group)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Group with this name already exists",
        )

    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
):
    group = db.get(Group, group_id)

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    db.delete(group)
    db.commit()


@router.get("/{group_id}/users", response_model=list[UserInGroup])
def get_group_users(
    group_id: int,
    db: Session = Depends(get_db),
):
    group = db.get(Group, group_id)

    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    statement = (
        select(User)
        .join(User.tags)
        .join(Tag.groups)
        .where(
            Group.id == group_id,
            User.is_active.is_(True),
        )
        .distinct()
        .order_by(User.id)
    )

    users = db.scalars(statement).all()

    return users