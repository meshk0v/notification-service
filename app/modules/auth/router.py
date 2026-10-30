
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.infrastructure.security import (
    create_access_token,
    verify_password,
)
from app.modules.auth.dependencies import get_current_employee
from app.modules.auth.models import Employee
from app.modules.auth.schemas import (
    TokenResponse,
    EmployeeResponse,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(
        Employee.username == form_data.username
    ).first()

    if (
        employee is None
        or not employee.is_active
        or not verify_password(
            form_data.password,
            employee.password_hash,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    token = create_access_token(employee.username)

    return {
        "access_token": token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=EmployeeResponse)
def get_me(
    employee: Employee = Depends(get_current_employee),
):
    return employee
