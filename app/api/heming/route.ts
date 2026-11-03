import { NextResponse, type NextRequest } from 'next/server';
import { buildHemingSystemPrompt } from '@/lib/ai/prompts';
import { openChatStream, ProviderError } from '@/lib/ai/provider';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const dynamic = 'force-dynamic';

/** 合盘：前端发两张已排好的盘 + 可选问题，模型只负责解读，不再起盘。 */
export async function POST(req: NextRequest) {
  let body: { chartA?: ZiweiChart; chartB?: ZiweiChart; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const { chartA, chartB } = body;
  if (!chartA?.palaces?.length || !chartB?.palaces?.length) {
    return NextResponse.json({ error: '合盘需要两张完整命盘（chartA / chartB）' }, { status: 400 });
  }

  const question =
    typeof body.question === 'string' && body.question.trim()
      ? body.question.trim()
      : '请按合盘方法论分析这两张盘的缘分与相处建议。';

  try {
    const stream = await openChatStream({
      system: buildHemingSystemPrompt(chartA, chartB),
      messages: [{ role: 'user', content: question }],
      maxTokens: 8192,
      temperature: 0.65,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError(e instanceof Error ? e.message : '合盘分析失败');
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
