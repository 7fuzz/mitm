import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch('http://127.0.0.1:3001/variables', { cache: 'no-store' });
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch('http://127.0.0.1:3001/variables', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return NextResponse.json(await res.json());
}
