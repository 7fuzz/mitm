import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch('http://127.0.0.1:3001/state', { cache: 'no-store' });
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  try {
    // Read as raw text first so it doesn't crash if the body is empty
    const text = await req.text();
    const body = text ? JSON.parse(text) : {};

    const res = await fetch('http://127.0.0.1:3001/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return NextResponse.json(await res.json());
  } catch (error) {
    // Catch JSON parsing errors gracefully instead of crashing Next.js
    console.error("State API Error:", error);
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
}
