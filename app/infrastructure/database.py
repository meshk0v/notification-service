from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.infrastructure.config import settings


# Подключение к PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)


# Фабрика сессий
SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine
)


# Базовый класс для моделей
class Base(DeclarativeBase):
    pass


# Dependency для FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()