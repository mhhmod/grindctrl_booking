import type { NextRequest } from 'next/server';
import { pickRequest } from '../handler';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) { return pickRequest(request, true); }
