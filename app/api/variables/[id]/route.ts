import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:3001';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    // Await params for Next.js 15+ compatibility
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/variables/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return NextResponse.json(await response.json());
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Backend unreachable' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;

    const response = await fetch(`${BACKEND_URL}/variables/${id}`, {
      method: 'DELETE'
    });

    return NextResponse.json(await response.json());
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Backend unreachable' }, { status: 500 });
  }
}
