import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Extract the envId from the Next.js request URL
    const { searchParams } = new URL(request.url);
    const envId = searchParams.get('envId');

    // Pass it along to Python
    const targetUrl = envId ? `http://127.0.0.1:3001/variables?envId=${envId}` : 'http://127.0.0.1:3001/variables';

    const response = await fetch(targetUrl);
    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Backend unreachable' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch('http://127.0.0.1:3001/variables', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return NextResponse.json(await res.json());
}
