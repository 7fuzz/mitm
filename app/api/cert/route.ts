import { NextResponse } from 'next/server';

export async function GET() {
  // Fetch the file directly from the Python server
  const res = await fetch('http://127.0.0.1:3001/cert');
  if (!res.ok) return new NextResponse("Cert not found", { status: 404 });

  const blob = await res.blob();
  return new NextResponse(blob, {
    headers: {
      'Content-Disposition': 'attachment; filename="mitmproxy-ca-cert.pem"',
      'Content-Type': 'application/x-x509-ca-cert',
    }
  });
}
