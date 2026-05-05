import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await fetch(`http://127.0.0.1:3001/saved/${id}`, { method: 'DELETE' });
  return NextResponse.json({ success: true });
}
