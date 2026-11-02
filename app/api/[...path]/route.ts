import { NextResponse } from 'next/server';

// Specific /api routes win over this catch-all; anything else gets a JSON 404
// instead of the HTML app shell with a 200.
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
