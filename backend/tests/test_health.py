"""Health endpoint and application factory tests."""

from __future__ import annotations

from httpx import AsyncClient

from app.core.config import settings


async def test_health_returns_ok(client: AsyncClient) -> None:
    response = await client.get(f"{settings.api_v1_prefix}/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "humera-automobile-api"
    assert payload["version"] == settings.app_version
    assert payload["environment"] == settings.app_env


async def test_health_includes_correlation_id(client: AsyncClient) -> None:
    response = await client.get(f"{settings.api_v1_prefix}/health")

    assert "X-Request-ID" in response.headers
    assert response.headers["X-Request-ID"]


async def test_health_echoes_incoming_request_id(client: AsyncClient) -> None:
    response = await client.get(
        f"{settings.api_v1_prefix}/health", headers={"X-Request-ID": "abc123"}
    )

    assert response.headers["X-Request-ID"] == "abc123"


async def test_health_sets_security_headers(client: AsyncClient) -> None:
    response = await client.get(f"{settings.api_v1_prefix}/health")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


async def test_readiness_reports_database_state(client: AsyncClient) -> None:
    response = await client.get(f"{settings.api_v1_prefix}/health/ready")

    assert response.status_code == 200
    assert response.json()["database"] == "ok"


async def test_root_discovery_document(client: AsyncClient) -> None:
    response = await client.get("/")

    assert response.status_code == 200
    assert response.json()["api"] == settings.api_v1_prefix


async def test_openapi_schema_is_served(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == settings.app_name


async def test_unknown_route_returns_structured_error(client: AsyncClient) -> None:
    response = await client.get(f"{settings.api_v1_prefix}/does-not-exist")

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "not_found"
    assert "request_id" in body["error"]
