from fastapi import FastAPI, Depends


from app.modules.users.router import router as users_router
from app.modules.tags.router import router as tags_router
from app.modules.groups.router import router as groups_router
from app.modules.templates.router import router as templates_router
from app.modules.campaigns.router import router as campaigns_router
from app.modules.stats.router import router as stats_router
from app.modules.auth.router import router as auth_router
from app.modules.auth.dependencies import get_current_employee

app = FastAPI(
    title="Notification Service",
    description="Mass notification delivery system",
    version="1.0.0",
)

app.include_router(auth_router)

app.include_router(
    users_router,
    dependencies=[Depends(get_current_employee)],
)

app.include_router(
    tags_router,
    dependencies=[Depends(get_current_employee)],
)

app.include_router(
    groups_router,
    dependencies=[Depends(get_current_employee)],
)

app.include_router(
    templates_router,
    dependencies=[Depends(get_current_employee)],
)

app.include_router(
    campaigns_router,
    dependencies=[Depends(get_current_employee)],
)

app.include_router(
    stats_router,
    dependencies=[Depends(get_current_employee)],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Notification Service"}