import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await fetch(`http://127.0.0.1:3001/history/${params.id}`, { method: 'DELETE' });
  return NextResponse.json({ success: true });
}
