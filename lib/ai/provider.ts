/**
 * 大模型接入层（服务端专用）
 *
 * 目标是「填了环境变量就能用」，不绑死厂商：
 *   AI_PROVIDER=deepseek | openai | anthropic | ollama | mimo（默认 deepseek）
 *   AI_API_KEY / AI_BASE_URL / AI_MODEL 可以覆盖预设
 *
 * 也兼容 .env.example 里原有的 DEEPSEEK_API_KEY / MIMO_* 命名。
 */

import 'server-only';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

type ProviderKind = 'openai' | 'anthropic';

interface ProviderPreset {
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  /** 依次尝试这些环境变量作为 key */
  keyEnv?: string[];
  /** 没有 key 也允许调用（本地 Ollama） */
  keyOptional?: boolean;
}

const PRESETS: Record<string, ProviderPreset> = {
  deepseek: {
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyEnv: ['DEEPSEEK_API_KEY', 'AI_API_KEY'],
  },
  openai: {
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyEnv: ['OPENAI_API_KEY', 'AI_API_KEY'],
  },
  anthropic: {
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    keyEnv: ['ANTHROPIC_API_KEY', 'AI_API_KEY'],
  },
  ollama: {
    kind: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:14b',
    keyOptional: true,
  },
  mimo: {
    kind: 'openai',
    baseUrl: process.env.MIMO_BASE_URL || '',
    model: process.env.MIMO_MODEL || 'mimo',
    keyEnv: ['MIMO_API_KEY', 'AI_API_KEY'],
  },
};

export interface ResolvedProvider {
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  name: string;
}

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}

/**
 * 统一 base URL。用户经常直接把完整接口地址贴进环境变量，这里都兜住：
 *   https://x.com/v1/chat/completions → https://x.com/v1
 *   https://x.com/v1/messages         → https://x.com/v1
 *   https://api.anthropic.com/v1      → https://api.anthropic.com
 */
function normalizeBaseUrl(raw: string, kind: ProviderKind): string {
  let url = raw.trim().replace(/\/+$/, '');
  url = url.replace(/\/(chat\/completions|completions|messages)$/i, '').replace(/\/+$/, '');
  if (kind === 'anthropic') url = url.replace(/\/v1$/i, '');
  return url;
}

export function resolveProvider(): ResolvedProvider {
  const name = (process.env.AI_PROVIDER || 'deepseek').toLowerCase().trim();
  const preset = PRESETS[name];

  if (!preset) {
    throw new ProviderError(
      `未知的 AI_PROVIDER「${name}」，可选：${Object.keys(PRESETS).join(' / ')}；` +
        '或者直接设 AI_BASE_URL + AI_MODEL 走任意 OpenAI 兼容服务。',
      500,
    );
  }

  const baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL || preset.baseUrl || '', preset.kind);
  const model = process.env.AI_MODEL || preset.model;
  const apiKey =
    process.env.AI_API_KEY ||
    (preset.keyEnv ?? []).map(k => process.env[k]).find(Boolean) ||
    '';

  if (!baseUrl) {
    throw new ProviderError(`AI_PROVIDER=${name} 缺少 base URL，请设置 AI_BASE_URL。`, 500);
  }
  if (!apiKey && !preset.keyOptional) {
    const hint = preset.keyEnv?.[0] ?? 'AI_API_KEY';
    throw new ProviderError(
      `未配置模型 API Key：请在 .env.local 里设置 ${hint}（或通用变量 AI_API_KEY）。`,
      500,
    );
  }

  return { kind: preset.kind, baseUrl, model, apiKey, name };
}

interface UpstreamRequest {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  temperature?: number;
}

async function callUpstream(cfg: ResolvedProvider, req: UpstreamRequest): Promise<Response> {
  // 推理型模型（deepseek-vX-flash 等）会先花掉一大截 token 在 reasoning_content 上，
  // 给 2048 会出现「推理没想完就被截断、正文一个字没有」。默认 8192，可用 AI_MAX_TOKENS 覆盖。
  const envMax = Number(process.env.AI_MAX_TOKENS || 0);
  const maxTokens = req.maxTokens ?? (Number.isFinite(envMax) && envMax > 0 ? envMax : 8192);
  const temperature = req.temperature ?? 0.7;

  if (cfg.kind === 'anthropic') {
    return fetch(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        system: req.system,
        messages: req.messages,
      }),
    });
  }

  return fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey || 'ollama'}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
    }),
  });
}

/** 把上游厂商的 SSE 统一转成前端要的 `data: {"delta":{"text":"…"}}` 格式 */
function toClientSSE(upstream: Response, kind: ProviderKind): ReadableStream<Uint8Array> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let sawContent = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();

      if (done) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let out = '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue; // event: / 注释 / 心跳都跳过
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta ?? {};
          const text =
            kind === 'anthropic'
              ? json.type === 'content_block_delta'
                ? (json.delta?.text ?? '')
                : ''
              : (delta.content ?? '');
          // 推理型模型（deepseek-vX-flash / R1 等）会先吐一长段 reasoning_content，
          // 此时 content 还是空的。把推理片段也转出去：一是让前端知道模型在思考，
          // 二是保证连接一直有字节，不会 60 秒收不到东西被判定卡死。
          const reasoning =
            kind === 'anthropic' ? '' : (delta.reasoning_content ?? delta.reasoning ?? '');
          if (reasoning) out += `data: ${JSON.stringify({ reasoning: { text: reasoning } })}\n\n`;
          if (text) {
            sawContent = true;
            out += `data: ${JSON.stringify({ delta: { text } })}\n\n`;
          }

          // 推理把 token 吃光、正文一个字没出：明说原因，别让界面一直空着
          const finish = json.choices?.[0]?.finish_reason;
          if (finish === 'length' && !sawContent) {
            out +=
              'data: ' +
              JSON.stringify({
                delta: {
                  text: '（本次输出被 max_tokens 截断：token 都花在推理上了，没有产出正文。可以在 .env.local 里设置 AI_MAX_TOKENS 调大，或换一个非推理模型。）',
                },
              }) +
              '\n\n';
          }
        } catch {
          // 单行解析失败不影响整条流
        }
      }

      if (out) controller.enqueue(encoder.encode(out));
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

/**
 * 调用模型并返回客户端可直接消费的 SSE 流。
 * 上游报错时抛 ProviderError（路由层转成 JSON，前端能显示具体原因）。
 */
export async function openChatStream(req: UpstreamRequest): Promise<ReadableStream<Uint8Array>> {
  const cfg = resolveProvider();

  let upstream: Response;
  try {
    upstream = await callUpstream(cfg, req);
  } catch (e) {
    const reason = e instanceof Error ? e.message : '未知网络错误';
    throw new ProviderError(`连接模型服务失败（${cfg.name}）：${reason}`, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    const snippet = detail.slice(0, 300).replace(/\s+/g, ' ').trim();
    throw new ProviderError(
      `模型服务返回 ${upstream.status}（${cfg.name} / ${cfg.model}）${snippet ? `：${snippet}` : ''}`,
      upstream.status === 401 || upstream.status === 403 ? 401 : 502,
    );
  }

  return toClientSSE(upstream, cfg.kind);
}
