export function getApiBaseUrl() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'http://127.0.0.1:5000';
  }

  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;

  // Prefer same-origin API requests in the browser so auth flows keep working
  // even when direct access to localhost:5000 is blocked or treated differently.
  return '';
}

export function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}
