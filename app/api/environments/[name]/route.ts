import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:3001';

export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> | { name: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/environments/${encodeURIComponent(resolvedParams.name)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return NextResponse.json(await response.json());
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Backend unreachable' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ name: string }> | { name: string } }) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const response = await fetch(`${BACKEND_URL}/environments/${encodeURIComponent(resolvedParams.name)}`, {
      method: 'DELETE'
    });
    return NextResponse.json(await response.json());
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Backend unreachable' }, { status: 500 });
  }
}
