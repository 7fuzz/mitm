import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:3001';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = params.id;

    const res = await fetch(`${BACKEND_URL}/repeater/${id}/history`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = params.id;

    const res = await fetch(`${BACKEND_URL}/repeater/${id}/history`, {
      method: 'DELETE',
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
