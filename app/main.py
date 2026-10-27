from fastapi import FastAPI

from app.modules.users.router import router as users_router
from app.modules.tags.router import router as tags_router
from app.modules.groups.router import router as groups_router
from app.modules.templates.router import router as templates_router
from app.modules.campaigns.router import router as campaigns_router

app = FastAPI(
    title="Notification Service",
    description="Mass notification delivery system",
    version="1.0.0",
)

app.include_router(users_router)
app.include_router(tags_router)
app.include_router(groups_router)
app.include_router(templates_router)
app.include_router(campaigns_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"message": "Notification Service"}