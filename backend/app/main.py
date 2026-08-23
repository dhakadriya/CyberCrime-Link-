"""
CrimeLink — FastAPI Application Entry Point
─────────────────────────────────────────────
This is the central application factory. It:
1. Creates the FastAPI app
2. Registers all middleware (CORS, rate limiting, security headers)
3. Mounts all routers
4. Sets up startup/shutdown events

SECURITY HEADERS explained:
- X-Content-Type-Options: nosniff → prevents MIME-type sniffing attacks
- X-Frame-Options: DENY → prevents clickjacking
- Referrer-Policy: strict-origin-when-cross-origin → limits referrer leakage
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import check_database_health, create_all_tables
from app.core.logging import setup_logging, app_logger

# ── Import all routers ───────────────────────────────────────────────────────
from app.modules.auth.router import router as auth_router
from app.modules.cases.router import router as cases_router
from app.modules.persons.router import router as persons_router
from app.modules.persons.router import cases_persons_router
from app.modules.evidence.router import router as evidence_router
from app.modules.investigation.router import router as investigation_router
from app.modules.relationships.router import router as relationships_router
from app.modules.prioritization.router import router as prioritization_router
from app.modules.users.router import router as users_router
from app.modules.audit.router import router as audit_router
from app.modules.security_events.router import router as security_events_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.reports.router import router as reports_router

# Import new modules
from app.modules.import_cases.router import router as import_router
from app.modules.network_analysis.router import router as network_router
from app.modules.nlp.router import router as nlp_router
from app.modules.leads.router import router as leads_router
from app.modules.entities.router import router as entities_router
from app.modules.query.router import router as query_router
from app.modules.geospatial.router import router as geospatial_router

# ── Setup logging before anything else ──────────────────────────────────────
setup_logging()

# ── Rate Limiter (global) ────────────────────────────────────────────────────
# Using slowapi — a thin wrapper around limits for FastAPI
limiter = Limiter(key_func=get_remote_address)


# ── Security Headers Middleware ──────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds security headers to every response.
    
    These headers protect against common web attacks:
    - nosniff: stops browser from guessing MIME type (prevents some XSS vectors)
    - DENY frame: prevents our app from being embedded in iframes (clickjacking)
    - Referrer-Policy: limits how much URL info is sent in Referer headers
    - CSP: tells browser what sources are allowed to load resources
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


# ── Request Logging Middleware ────────────────────────────────────────────────
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every incoming request. Excludes health check spam."""
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)
        
        response = await call_next(request)
        
        app_logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            client=request.client.host if request.client else "unknown",
        )
        return response


# ── Application Lifecycle ────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup checks, then yield (app runs), then cleanup."""
    app_logger.info("crimelink_starting", version=settings.APP_VERSION,
                    environment=settings.ENVIRONMENT)
    
    # For SQLite (local dev): auto-create tables
    if settings.DATABASE_URL.startswith("sqlite") or "sqlite" in settings.resolved_database_url:
        await create_all_tables()
        app_logger.info("sqlite_tables_created")
    
    # Verify database connectivity on startup
    db_ok = await check_database_health()
    if db_ok:
        app_logger.info("database_connection_ok")
    else:
        app_logger.error("database_connection_failed — check DATABASE_URL")
    
    yield  # Application is running here
    
    app_logger.info("crimelink_shutdown")


# ── Create FastAPI App ───────────────────────────────────────────────────────
app = FastAPI(
    title="CrimeLink API",
    description=(
        "Secure Criminal Investigation & Evidence Management System. "
        "DEMO ENVIRONMENT — SYNTHETIC INVESTIGATION DATA ONLY."
    ),
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
    redirect_slashes=False,  # Prevent 307 redirects that strip Authorization headers
)

# ── Rate Limiter ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────────
# NEVER use allow_origins=["*"] — that allows any website to call our API
# We use environment-configured allowed origins only
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# ── Custom Middleware ─────────────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)


# ── Global Exception Handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for unexpected errors.
    
    IMPORTANT: We log the full error server-side but return a SAFE
    generic message to the client. Never expose stack traces or
    internal details to the frontend.
    """
    app_logger.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please contact support."},
    )


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"], include_in_schema=False)
async def health_check():
    """Simple health check for Docker/load balancer."""
    db_ok = await check_database_health()
    return {
        "status": "healthy" if db_ok else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_ok else "disconnected",
    }


# ── Register All Routers ──────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(cases_router, prefix=API_PREFIX)
app.include_router(cases_persons_router, prefix=API_PREFIX)
app.include_router(persons_router, prefix=API_PREFIX)
app.include_router(evidence_router, prefix=API_PREFIX)
app.include_router(investigation_router, prefix=API_PREFIX)
app.include_router(relationships_router, prefix=API_PREFIX)
app.include_router(prioritization_router, prefix=API_PREFIX)
app.include_router(audit_router, prefix=API_PREFIX)
app.include_router(security_events_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(reports_router, prefix=API_PREFIX)
app.include_router(import_router, prefix=API_PREFIX)
app.include_router(network_router, prefix=API_PREFIX)
app.include_router(nlp_router, prefix=API_PREFIX)
app.include_router(leads_router, prefix=API_PREFIX)
app.include_router(entities_router, prefix=API_PREFIX)
app.include_router(query_router, prefix=API_PREFIX)
app.include_router(geospatial_router, prefix=API_PREFIX)


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
        "note": "DEMO ENVIRONMENT — SYNTHETIC INVESTIGATION DATA",
    }
