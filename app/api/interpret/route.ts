import { NextResponse, type NextRequest } from 'next/server';
import { buildInterpretSystemPrompt } from '@/lib/ai/prompts';
import { openChatStream, ProviderError, type ChatTurn } from '@/lib/ai/provider';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const dynamic = 'force-dynamic';

/** 前端只发 chart + 对话历史，命盘事实在这里由引擎转成文本再喂模型。 */
export async function POST(req: NextRequest) {
  let body: { chart?: ZiweiChart; messages?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const chart = body.chart;
  if (!chart || !Array.isArray(chart.palaces) || chart.palaces.length === 0) {
    return NextResponse.json({ error: '缺少命盘数据（chart）' }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
    .slice(-20);

  if (messages.length === 0) {
    return NextResponse.json({ error: '缺少对话内容（messages）' }, { status: 400 });
  }

  try {
    const stream = await openChatStream({
      system: buildInterpretSystemPrompt(chart),
      messages,
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
    const err = e instanceof ProviderError ? e : new ProviderError(e instanceof Error ? e.message : '解读失败');
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
