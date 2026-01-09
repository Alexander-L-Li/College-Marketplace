import { jwtDecode } from "jwt-decode";

export function getToken() {
  return localStorage.getItem("token");
}

export function isTokenExpired(token) {
  try {
    const { exp } = jwtDecode(token);
    if (!exp) return true;
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

export function decodeTokenSafe(token) {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

export function logout(navigate) {
  localStorage.removeItem("token");
  navigate("/login");
}

// Returns token if valid, otherwise logs out and returns null
export function requireAuth(navigate) {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    logout(navigate);
    return null;
  }
  return token;
}

// Fetch helper that attaches JWT and performs a clean "401/expired -> logout"
export async function authFetch(navigate, url, options = {}) {
  const token = requireAuth(navigate);
  if (!token) {
    throw new Error("Session expired. Please log in again.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    logout(navigate);
    throw new Error("Session expired. Please log in again.");
  }

  return res;
}


