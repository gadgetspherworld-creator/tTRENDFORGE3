const TOKEN_KEY = 'tf_token'
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  document.cookie = `tf_token=${token};path=/;max-age=${7 * 86400};SameSite=Lax`
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = 'tf_token=;path=/;max-age=0'
}
export function isLoggedIn(): boolean { return !!getToken() }
