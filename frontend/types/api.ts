/**
 * Shared API contract types.
 *
 * These mirror the shapes the backend actually returns. Keep them in sync with
 * `backend/app/core/errors.py` and the Pydantic schemas they describe - a
 * mismatch here is a type error at build time rather than a runtime surprise.
 */

/** Error envelope produced by the backend's centralised exception handlers. */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    request_id: string;
    details?: unknown;
  };
}

/** Paginated response envelope (see `backend/app/utils/pagination.py`). */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Query parameters accepted by every future list endpoint. */
export interface PageParams {
  page?: number;
  page_size?: number;
}
