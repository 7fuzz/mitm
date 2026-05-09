import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    const targetUrl = groupId ? `http://127.0.0.1:3001/repeater-db?groupId=${groupId}` : 'http://127.0.0.1:3001/repeater-db';

    const response = await fetch(targetUrl);
    return NextResponse.json(await response.json());
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Backend unreachable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch('http://127.0.0.1:3001/repeater-db', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return NextResponse.json(await res.json());
}
