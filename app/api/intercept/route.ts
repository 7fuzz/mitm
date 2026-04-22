import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, id, data } = body;

  if (action === 'config') {
    await fetch('http://127.0.0.1:3001/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  if (action === 'resume') {
    await fetch(`http://127.0.0.1:3001/resume/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  try {
    const res = await fetch('http://127.0.0.1:3001/config', {
      cache: 'no-store' // Ensure we always get the freshest state
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    // If the Python proxy isn't running yet, fallback safely to defaults
    return NextResponse.json({
      enabled: false,
      mode: 'both',
      ignored_methods: ['OPTIONS']
    });
  }
}
