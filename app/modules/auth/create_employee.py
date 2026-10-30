from getpass import getpass

from app.infrastructure.database import SessionLocal
from app.infrastructure.security import hash_password
from app.modules.auth.models import Employee


def main():
    username = input("Username: ").strip()

    if not username:
        print("Username cannot be empty")
        return

    password = getpass("Password: ")
    password_confirm = getpass("Confirm password: ")

    if len(password) < 8:
        print("Password must contain at least 8 characters")
        return

    if password != password_confirm:
        print("Passwords do not match")
        return

    with SessionLocal() as db:
        existing = db.query(Employee).filter(
            Employee.username == username
        ).first()

        if existing:
            print("Employee already exists")
            return

        employee = Employee(
            username=username,
            password_hash=hash_password(password),
        )

        db.add(employee)
        db.commit()

        print(f"Employee '{username}' created successfully")


if __name__ == "__main__":
    main()