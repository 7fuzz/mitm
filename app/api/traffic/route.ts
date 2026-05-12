// app/api/traffic/route.ts
import { NextRequest } from 'next/server';

// Manage multiple connected clients
const clients = new Set<ReadableStreamDefaultController>();

export async function POST(req: NextRequest) {
  const data = await req.json();

  const encoder = new TextEncoder();
  const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

  // Push to all connected clients
  clients.forEach(controller => {
    try {
      controller.enqueue(message);
    } catch (_e) {
      clients.delete(controller);
    }
  });

  return new Response('OK', { status: 200 });
}

export async function GET() {
  const encoder = new TextEncoder();
  let heartbeatTimer: any;

  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
      
      // Keep-alive heartbeat every 20 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (_e) {
          clients.delete(controller);
          clearInterval(heartbeatTimer);
        }
      }, 20000);
    },
    cancel(controller) {
      clients.delete(controller);
      clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering in Nginx if applicable
    },
  });
}
