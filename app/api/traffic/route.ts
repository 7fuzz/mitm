// app/api/traffic/route.ts
import { NextRequest } from 'next/server';

// This is a simple in-memory stream controller
let clientController: ReadableStreamDefaultController | null = null;

export async function POST(req: NextRequest) {
  const data = await req.json();

  // If a frontend is connected, push the data to it
  if (clientController) {
    const encoder = new TextEncoder();
    clientController.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }

  return new Response('OK', { status: 200 });
}

export async function GET() {
  // This creates a persistent connection for the frontend (SSE)
  const stream = new ReadableStream({
    start(controller) {
      clientController = controller;
    },
    cancel() {
      clientController = null;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
