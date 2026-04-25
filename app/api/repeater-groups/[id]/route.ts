import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:3001';

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    // Unwrap the params Promise
    const params = await props.params;
    const id = params.id;

    const body = await req.json();

    const res = await fetch(`${BACKEND_URL}/repeater-groups/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    // Unwrap the params Promise
    const params = await props.params;
    const id = params.id;

    const res = await fetch(`${BACKEND_URL}/repeater-groups/${id}`, {
      method: 'DELETE',
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
