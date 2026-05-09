import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PYTHON_API = 'http://127.0.0.1:3001';

export async function GET() {
  try {
    const res = await fetch(`${PYTHON_API}/replacements`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (_e) {
    return NextResponse.json({ error: 'Failed to fetch replacements from proxy' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const res = await fetch(`${PYTHON_API}/replacements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (_error) {
    console.error("Replacements API Error:", error);
    return NextResponse.json({ success: false, error: 'Failed to save replacements' }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    
    const res = await fetch(`${PYTHON_API}/replacements`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Failed to update replacement order' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    
    const res = await fetch(`${PYTHON_API}/replacements`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (_error) {
    return NextResponse.json({ success: false, error: 'Failed to delete replacement' }, { status: 400 });
  }
}
