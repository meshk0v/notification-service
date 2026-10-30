from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.tags.models import Tag
from app.modules.tags.schemas import TagCreate, TagResponse
from app.modules.users.models import User


router = APIRouter(
    prefix="/tags",
    tags=["Tags"],
)


@router.post(
    "/",
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_tag(
    tag_data: TagCreate,
    db: Session = Depends(get_db),
):
    tag = Tag(name=tag_data.name.strip().lower())

    db.add(tag)

    try:
        db.commit()
        db.refresh(tag)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tag already exists",
        )

    return tag


@router.get("/", response_model=list[TagResponse])
def get_tags(db: Session = Depends(get_db)):
    statement = select(Tag).order_by(Tag.name)
    return db.scalars(statement).all()


@router.post(
    "/{tag_id}/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def assign_tag_to_user(
    tag_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    tag = db.get(Tag, tag_id)
    user = db.get(User, user_id)

    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")

    if user is None or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")

    if tag not in user.tags:
        user.tags.append(tag)
        db.commit()

    return None


@router.delete(
    "/{tag_id}/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_tag_from_user(
    tag_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    tag = db.get(Tag, tag_id)
    user = db.get(User, user_id)

    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")

    if user is None or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")

    if tag in user.tags:
        user.tags.remove(tag)
        db.commit()

    return None