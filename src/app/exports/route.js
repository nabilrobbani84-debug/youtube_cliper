const backendBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://127.0.0.1:5000';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forwardHeaders(request) {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const userId = request.headers.get('user-id');
  const authorization = request.headers.get('authorization');
  const xApiKey = request.headers.get('x-api-key');

  if (contentType) headers.set('content-type', contentType);
  if (userId) headers.set('user-id', userId);
  if (authorization) headers.set('authorization', authorization);
  if (xApiKey) headers.set('x-api-key', xApiKey);

  return headers;
}

export async function GET(request) {
  const normalizedBase = backendBaseUrl.endsWith('/')
    ? backendBaseUrl.slice(0, -1)
    : backendBaseUrl;
  const query = request.nextUrl.searchParams.toString();
  const targetUrl = `${normalizedBase}/exports${query ? `?${query}` : ''}`;

  const backendResponse = await fetch(targetUrl, {
    method: 'GET',
    headers: forwardHeaders(request)
  });

  const responseHeaders = new Headers();
  const contentType = backendResponse.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);

  return new Response(await backendResponse.arrayBuffer(), {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}
