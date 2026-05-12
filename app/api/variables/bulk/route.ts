import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:3001';

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/variables-bulk`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return NextResponse.json(await response.json());
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Backend unreachable' }, { status: 500 });
  }
}
