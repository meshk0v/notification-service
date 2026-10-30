from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.infrastructure.security import decode_access_token
from app.modules.auth.models import Employee


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_employee(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Employee:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        username = payload.get("sub")

        if not username:
            raise credentials_error

    except JWTError:
        raise credentials_error

    employee = db.query(Employee).filter(
        Employee.username == username
    ).first()

    if employee is None or not employee.is_active:
        raise credentials_error

    return employee