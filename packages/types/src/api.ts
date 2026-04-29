export interface ApiResponse<T> {
  data: T
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  code: string
  message: string
  field?: string
}

export interface ApiErrorResponse {
  error: ApiError
}

export interface HealthResponse {
  ok: boolean
  version: string
}

export interface ListQueryParams {
  page?: number
  limit?: number
  status?: string
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
}
