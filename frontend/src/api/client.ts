import axios from "axios";

const TOKEN_KEY = "nrrms_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable: the session lasts until the page reloads
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing stored
  }
}

// Shared axios instance. G1 owns this file: the interceptor adds the bearer token
// that /auth/login and /auth/signup return.
export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or revoked token would otherwise keep being sent; drop it so protected
// pages send the user back to sign in.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) clearToken();
    return Promise.reject(error);
  },
);

/** Message from the {"detail", "code"} error body, or a generic fallback. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (!error.response) return "Cannot reach the server. Check your connection.";
  }
  return "Something went wrong. Please try again.";
}
