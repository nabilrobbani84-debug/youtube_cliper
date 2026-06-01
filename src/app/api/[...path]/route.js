const backendBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  'http://127.0.0.1:5000';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildTargetUrl(pathSegments, searchParams) {
  const normalizedBase = backendBaseUrl.endsWith('/')
    ? backendBaseUrl.slice(0, -1)
    : backendBaseUrl;
  const joinedPath = pathSegments.join('/');
  const query = searchParams.toString();
  return `${normalizedBase}/api/${joinedPath}${query ? `?${query}` : ''}`;
}

function forwardHeaders(request) {
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const userId = request.headers.get('user-id');
  const authorization = request.headers.get('authorization');

  if (contentType) headers.set('content-type', contentType);
  if (userId) headers.set('user-id', userId);
  if (authorization) headers.set('authorization', authorization);

  return headers;
}

async function proxy(request, context) {
  const pathSegments = context.params.path || [];
  const targetUrl = buildTargetUrl(pathSegments, request.nextUrl.searchParams);
  const method = request.method;

  const init = {
    method,
    headers: forwardHeaders(request),
    redirect: 'manual',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.text();
  }

  const backendResponse = await fetch(targetUrl, init);
  const responseHeaders = new Headers();
  const contentType = backendResponse.headers.get('content-type');
  const contentDisposition = backendResponse.headers.get('content-disposition');

  if (contentType) responseHeaders.set('content-type', contentType);
  if (contentDisposition) responseHeaders.set('content-disposition', contentDisposition);

  return new Response(await backendResponse.arrayBuffer(), {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request, context) {
  return proxy(request, context);
}

export async function POST(request, context) {
  return proxy(request, context);
}

export async function PUT(request, context) {
  return proxy(request, context);
}

export async function DELETE(request, context) {
  return proxy(request, context);
}

export async function OPTIONS(request, context) {
  return proxy(request, context);
}
