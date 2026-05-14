// app/api/traffic/route.ts
import { NextRequest } from 'next/server';

// Manage multiple connected clients
const clients = new Set<ReadableStreamDefaultController>();
let globalHeartbeat: NodeJS.Timeout | null = null;

function cleanupAll() {
  if (globalHeartbeat) {
    clearInterval(globalHeartbeat);
    globalHeartbeat = null;
  }
  clients.forEach(c => {
    try { c.close(); } catch(e) {}
  });
  clients.clear();
}

// Ensure connections are closed on process termination so Next.js can exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', cleanupAll);
  process.on('SIGTERM', cleanupAll);
}

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

  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
      
      // Start global heartbeat if not already running
      if (!globalHeartbeat) {
        globalHeartbeat = setInterval(() => {
          const message = encoder.encode(': heartbeat\n\n');
          clients.forEach(c => {
            try {
              c.enqueue(message);
            } catch (_e) {
              clients.delete(c);
            }
          });
          
          // Stop heartbeat if no clients left
          if (clients.size === 0 && globalHeartbeat) {
            clearInterval(globalHeartbeat);
            globalHeartbeat = null;
          }
        }, 20000);
      }
    },
    cancel(controller) {
      clients.delete(controller);
      if (clients.size === 0 && globalHeartbeat) {
        clearInterval(globalHeartbeat);
        globalHeartbeat = null;
      }
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
