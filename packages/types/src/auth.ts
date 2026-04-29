export interface User {
  id: string
  email: string
  name: string | null
  createdAt: string
  updatedAt: string
}

export interface Session {
  user: User
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export interface JwtPayload {
  sub: string
  email: string
  iat: number
  exp: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export interface RefreshRequest {
  refreshToken: string
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}
