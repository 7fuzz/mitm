import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch('http://127.0.0.1:3001/history', { cache: 'no-store' });
  return NextResponse.json(await res.json());
}

export async function DELETE() {
  await fetch('http://127.0.0.1:3001/history', { method: 'DELETE' });
  return NextResponse.json({ success: true });
}
