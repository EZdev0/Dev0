import { ExpoRequest } from 'expo-router/server';

export async function POST(request: ExpoRequest) {
  try {
    const body = await request.json();
    let endpoint = body.endpoint;

    if (!endpoint) {
      endpoint = 'https://toolkit.rork.com/agent/chat';
    }

    if (!endpoint.startsWith('https://toolkit.rork.com')) {
      return Response.json({ error: 'Invalid endpoint' }, { status: 400 });
    }

    const fetchConfig = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body.messages ? { messages: body.messages } : body)
    };

    const response = await fetch(endpoint, fetchConfig);

    // Pass along the response body as-is to preserve streaming
    // We create a new response using the remote response's body and headers
    const newHeaders = new Headers(response.headers);

    // We cannot construct Response.json if it is streaming, so we return the raw Response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error: any) {
    console.error('API proxy error:', error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
