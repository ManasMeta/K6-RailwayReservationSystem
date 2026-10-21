import axios from "axios";

// Shared axios instance. G1 owns this file: the bearer-token interceptor below
// is a placeholder until the auth module stores the real JWT.
export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("nrrms_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // storage unavailable: continue unauthenticated
  }
  return config;
});

/** Message from the {"detail", "code"} error body, or a generic fallback. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (!error.response) return "Cannot reach the server. Check your connection.";
  }
  return "Something went wrong. Please try again.";
}
