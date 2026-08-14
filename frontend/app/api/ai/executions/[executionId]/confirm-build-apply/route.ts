import { NextResponse, type NextRequest } from 'next/server';
import { proxyConfirmBuildApply } from '@/lib/build-apply-confirm-proxy.server';

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ executionId: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  const result = await proxyConfirmBuildApply({
    executionId: params.executionId,
    cookieHeader: request.headers.get('cookie'),
    incomingInternalServiceKeyHeader: request.headers.get('x-internal-service-key'),
    payload: await readJsonBody(request),
  });

  return NextResponse.json(result.body, { status: result.status });
}
