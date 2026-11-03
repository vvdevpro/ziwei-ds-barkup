'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
}

/** 13 维：第一行 6 个（最常看），第二行 7 个（与数据集同维度） */
const TOPICS = [
  { key: 'overview', label: '命格', row: 0 },
  { key: 'love', label: '感情', row: 0 },
  { key: 'career', label: '事业', row: 0 },
  { key: 'wealth', label: '财运', row: 0 },
  { key: 'health', label: '健康', row: 0 },
  { key: 'personality', label: '性格', row: 0 },
  { key: 'family', label: '兄弟', row: 1 },
  { key: 'children', label: '子女', row: 1 },
  { key: 'move', label: '迁移', row: 1 },
  { key: 'friends', label: '人际', row: 1 },
  { key: 'home', label: '田宅', row: 1 },
  { key: 'spirit', label: '福德', row: 1 },
  { key: 'parents', label: '父母', row: 1 },
] as const;

const TOPIC_PROMPTS: Record<string, string> = {
  overview: `请生成命格总览，按以下结构输出：

**【命格定性】**
用一句话概括这个命盘的核心格局与命主气质。

**【主星解读】**
命宫主星的核心特质，引用倪海厦原话或观点。

**【三方四正】**
财、官、迁三宫的联动分析及整体格局。

**【当前大限】**
当下大限运势方向与最值得关注的事项。

**【优势与注意】**
命盘天赋优势，以及需要注意的风险或功课。`,

  love: `请深度分析感情婚姻运，按以下结构输出：

**【感情格局】**
一句话定性感情命格。

**【夫妻宫分析】**
夫妻宫主星、四化，以及倪海厦体系的具体解读。

**【三方联动】**
相关宫位对感情的影响。

**【当前大限感情运】**
当下 10 年感情走向与关键节点。

**【实际建议】**
具体可行的感情建议。`,

  career: `请深度分析事业运，按以下结构输出：

**【事业格局】**
一句话定性事业命格，宜任职或宜创业。

**【官禄宫分析】**
官禄宫主星、四化，以及倪师对这种配置的判断。

**【财帛宫联动】**
财运与事业的关系，财路来源分析。

**【当前大限事业运】**
当下 10 年事业走向。

**【实际建议】**
适合的方向、行业与策略。`,

  wealth: `请深度分析财运，按以下结构输出：

**【财运格局】**
一句话定性财运模式，是主动财还是被动财。

**【财帛宫分析】**
财帛宫主星、四化，财富来源与流动模式。

**【田宅宫（财库）】**
积蓄能力与不动产运势分析。

**【当前大限财运】**
当下财运走向与注意事项。

**【理财建议】**
具体的财务建议。`,

  health: `请分析健康运势，按以下结构输出：

**【疾厄宫主星】**
疾厄宫星曜与健康含义。

**【主要风险】**
结合倪海厦子午流注理论，分析主要健康隐患与需关注的部位。

**【大限健康走势】**
当下健康趋势与关键时间段。

**【预防建议】**
具体注意事项与养生方向。`,

  personality: `请深度解析性格特质，按以下结构输出：

**【命宫主星性格】**
命宫主星的核心性格特质，引用倪师原话。

**【三方性格综合】**
财、官、迁三宫对性格的影响，全貌描绘。

**【人际关系模式】**
与他人互动方式、待人处世风格。

**【优势与人生课题】**
天赋优势，以及需要面对的人生功课。`,

  family: `请分析兄弟宫（兄弟 / 合伙）这一维，按以下结构输出：

**【兄弟格局】**
一句话定性兄弟宫格局，与手足缘分厚薄。

**【兄弟宫分析】**
兄弟宫主星、亮度、四化对兄弟关系与合伙关系的具体含义。

**【合伙建议】**
适不适合与人合伙、适合什么类型的合作对象。

**【实际建议】**
具体可操作的建议。`,

  children: `请分析子女宫这一维，按以下结构输出：

**【子女缘】**
一句话定性子女缘分与下属缘分。

**【子女宫分析】**
子女宫主星、四化，以及倪师体系下的解读。

**【亲子互动】**
与子女的相处模式、教育倾向需注意之处。

**【实际建议】**
具体建议。`,

  move: `请分析迁移宫（外出 / 异地）这一维，按以下结构输出：

**【外出格局】**
一句话定性外出运与异地发展运。

**【迁移宫分析】**
迁移宫主星、四化，以及出差、搬迁、异地求财的含义。

**【与命宫的关系】**
迁移宫是命宫的对宫，它对命主本性起到了什么张力或补充。

**【实际建议】**
适合的方位倾向、外出注意事项。`,

  friends: `请分析交友宫（人际 / 贵人 / 小人）这一维，按以下结构输出：

**【人际格局】**
一句话定性人际面与朋友质量。

**【交友宫分析】**
交友宫主星、四化，看清贵人与小人分别落在何处。

**【借力方式】**
这一生主要靠什么类型的人助力，又容易被什么人拖累。

**【实际建议】**
具体的人际经营建议。`,

  home: `请分析田宅宫（不动产 / 家庭环境）这一维，按以下结构输出：

**【置产格局】**
一句话定性置产能力与家庭环境。

**【田宅宫分析】**
田宅宫主星、四化，不动产缘分与居住环境倾向。

**【财库联动】**
田宅为财库，它与财帛宫的关系说明什么。

**【实际建议】**
置产时机与居住选择的具体建议。`,

  spirit: `请分析福德宫（精神 / 内心）这一维，按以下结构输出：

**【精神格局】**
一句话定性精神世界与内心状态。

**【福德宫分析】**
福德宫主星、四化，说明这个人的精神追求与压力来源。

**【婚姻联动】**
倪师强调「婚姻要看福德」，这里说明福德宫对婚姻长久度的影响。

**【实际建议】**
内心调适与生活方式的具体建议。`,

  parents: `请分析父母宫（父母 / 长辈 / 文书）这一维，按以下结构输出：

**【父母缘分】**
一句话定性与父母的缘分（此维度判断本身局限较大，请注明仅供参考）。

**【父母宫分析】**
父母宫主星、四化，父母性格与相处模式。

**【长辈助力】**
来自长辈、上级、文书契约方面的影响。

**【实际建议】**
具体建议。`,
};

const PALACE_ROLES: Record<string, string> = {
  '命宫': '自我、性格、先天格局',
  '兄弟宫': '兄弟关系、合伙人',
  '夫妻宫': '感情关系、婚姻状态',
  '子女宫': '子女缘分、下属关系',
  '财帛宫': '财运来源、收入方式',
  '疾厄宫': '身体健康、意外',
  '迁移宫': '外出机遇、人际格局',
  '交友宫': '朋友圈、贵人、小人',
  '仆役': '朋友圈、贵人、小人',
  '官禄宫': '事业成就、社会地位',
  '田宅宫': '不动产、家庭环境',
  '福德宫': '精神享受、内心福分',
  '父母宫': '父母关系、文书契约',
};

/** 单个标签页的状态 */
interface TabState {
  text: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  error?: string;
  reasoningChars: number;
  history: ChatTurn[];
}

const EMPTY_TAB: TabState = { text: '', status: 'idle', reasoningChars: 0, history: [] };

interface PalaceTab {
  key: string;
  label: string;
  branch: number;
}

/** Render AI markdown: **【Title】** → gold header, **bold** → strong */
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} className="pt-3 pb-0.5 first:pt-0">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--t-gold)' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} className="font-medium" style={{ color: 'var(--t-text)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--t-gold)', opacity: 0.6 }}
        />
      )}
    </div>
  );
}

/**
 * 命盘解读面板 —— 选项卡式。
 *
 * · 13 个维度分两行（6 + 7）；
 * · 点宫位是「新增一个宫位标签」，不是顶掉原来的：原来那个宫的内容和请求都保留，
 *   再点回同一个宫不会重新推理；
 * · 面板高度固定，内容在内部滚动，解读再长也不会把整页撑长。
 */
export default function InsightPanel({ chart, selectedPalace }: InsightPanelProps) {
  const [tabs, setTabs] = useState<Record<string, TabState>>({});
  const [palaceTabs, setPalaceTabs] = useState<PalaceTab[]>([]);
  const [active, setActive] = useState<string>('overview');
  const [input, setInput] = useState('');

  const controllers = useRef<Record<string, AbortController>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  // 长文解读默认停在顶部（从头读），只有用户自己滚到底才跟随流式输出
  const stickToBottom = useRef(false);
  const startedRef = useRef<Record<string, boolean>>({});

  const tab = tabs[active] ?? EMPTY_TAB;

  const patchTab = useCallback((key: string, patch: Partial<TabState> | ((prev: TabState) => Partial<TabState>)) => {
    setTabs(prev => {
      const current = prev[key] ?? EMPTY_TAB;
      const next = typeof patch === 'function' ? patch(current) : patch;
      return { ...prev, [key]: { ...current, ...next } };
    });
  }, []);

  /** 发起一次流式请求，结果写进指定标签 */
  const run = useCallback(
    async (key: string, messages: ChatTurn[]) => {
      controllers.current[key]?.abort();
      const controller = new AbortController();
      controllers.current[key] = controller;

      patchTab(key, { status: 'loading', reasoningChars: 0, error: undefined });

      try {
        const res = await fetch('/api/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chart, messages }),
          signal: controller.signal,
        });

        if (res.status === 404) throw new Error('未找到 /api/interpret 接口。');
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.error || `解读请求失败（HTTP ${res.status}）`);
        }
        if (!res.body) throw new Error('服务端没有返回响应流');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const json = JSON.parse(data);
              const reasoning: string = json.reasoning?.text ?? '';
              if (reasoning) patchTab(key, prev => ({ reasoningChars: prev.reasoningChars + reasoning.length }));

              const delta: string = json.delta?.text ?? '';
              if (delta) patchTab(key, prev => ({ text: prev.text + delta }));
            } catch {
              /* 单行解析失败忽略 */
            }
          }
        }

        patchTab(key, { status: 'done' });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        patchTab(key, {
          status: 'error',
          error: e instanceof Error ? e.message : '解读失败，请稍后重试。',
        });
      }
    },
    [chart, patchTab],
  );

  /** 维度标签：懒加载，已生成过的不重复请求 */
  const ensureTopic = useCallback(
    (key: string) => {
      if (startedRef.current[key]) return;
      const prompt = TOPIC_PROMPTS[key];
      if (!prompt) return;
      startedRef.current[key] = true;
      patchTab(key, { history: [{ role: 'user', content: prompt }] });
      run(key, [{ role: 'user', content: prompt }]);
    },
    [patchTab, run],
  );

  // 换了一张盘（或首次进入）：清空所有标签缓存，重新生成命格
  useEffect(() => {
    Object.values(controllers.current).forEach(c => c.abort());
    controllers.current = {};
    startedRef.current = {};
    setTabs({});
    setPalaceTabs([]);
    setActive('overview');
    stickToBottom.current = false;

    const prompt = TOPIC_PROMPTS.overview;
    startedRef.current.overview = true;
    patchTab('overview', { history: [{ role: 'user', content: prompt }] });
    run('overview', [{ role: 'user', content: prompt }]);
  }, [chart, patchTab, run]);

  // 点宫位：已经有这个宫的标签就切过去（不重发），没有才新建并生成
  useEffect(() => {
    if (!selectedPalace) return;
    const key = `palace:${selectedPalace.branch}`;
    const label = selectedPalace.name;

    setPalaceTabs(prev => (prev.some(t => t.key === key) ? prev : [...prev, { key, label, branch: selectedPalace.branch }]));
    setActive(key);

    if (startedRef.current[key]) return; // 这一宫的解读已经在生成 / 已生成过
    startedRef.current[key] = true;
    stickToBottom.current = false;

    const majorStars = selectedPalace.stars.filter(s => s.type === 'major');
    const starDesc = majorStars.length > 0
      ? majorStars.map(s => `${s.name}${s.siHua ? '化' + s.siHua : ''}`).join('、')
      : '空宫（借对宫）';
    const role = PALACE_ROLES[selectedPalace.name] ?? '';

    const prompt = `请重点分析【${selectedPalace.name}】（主管：${role}），该宫主星为${starDesc}，按以下结构输出：

**【宫位定性】**
${selectedPalace.name}在命盘中的意义，以及这种星曜配置的整体判断。

**【主星解读】**
主星在此宫的倪海厦体系解读，引用具体观点。

**【三方四正联动】**
三方四正宫位对此宫的影响。

**【实际建议】**
基于此宫的具体建议。`;

    patchTab(key, { history: [{ role: 'user', content: prompt }] });
    run(key, [{ role: 'user', content: prompt }]);
  }, [selectedPalace, patchTab, run]);

  // 自动滚到底部（仅在用户本来就贴着底部时）
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [tab.text, tab.reasoningChars, active]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const switchTab = (key: string) => {
    stickToBottom.current = false;
    setActive(key);
    if (!key.startsWith('palace:')) ensureTopic(key);
  };

  const closePalaceTab = (key: string) => {
    controllers.current[key]?.abort();
    delete controllers.current[key];
    delete startedRef.current[key];
    setPalaceTabs(prev => prev.filter(t => t.key !== key));
    setTabs(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setActive(prev => (prev === key ? 'overview' : prev));
  };

  const send = () => {
    const question = input.trim();
    if (!question || tab.status === 'loading') return;
    setInput('');
    stickToBottom.current = true;

    const history: ChatTurn[] = [...tab.history, { role: 'user', content: question }];
    patchTab(active, prev => ({
      text: prev.text + `\n\n---\n\n**你问：** ${question}\n\n`,
      history,
    }));
    run(active, history);
  };

  const row0 = TOPICS.filter(t => t.row === 0);
  const row1 = TOPICS.filter(t => t.row === 1);
  const palaceLabel = palaceTabs.find(t => t.key === active)?.label;

  const loading = tab.status === 'loading';
  const showThinking = loading && !tab.text;

  const topicButton = (t: { key: string; label: string }) => {
    const isActive = active === t.key;
    const status = tabs[t.key]?.status;
    return (
      <button
        key={t.key}
        onClick={() => switchTab(t.key)}
        className="py-1.5 text-[10px] font-medium rounded-lg transition-all duration-150 relative"
        style={{
          background: isActive ? 'rgba(212,168,67,0.12)' : 'transparent',
          border: `1px solid ${isActive ? 'rgba(212,168,67,0.3)' : 'var(--t-border)'}`,
          color: isActive ? 'var(--t-gold)' : 'var(--t-faint)',
        }}
      >
        {t.label}
        {status === 'loading' && (
          <span className="absolute top-1 right-1 w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--t-gold)' }} />
        )}
      </button>
    );
  };

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden card-glass"
      style={{ height: 'clamp(480px, 72vh, 820px)' }}
    >
      {/* ── 13 维标签：两行（6 + 7）── */}
      <div className="flex-shrink-0 px-2 pt-2 pb-1.5 space-y-1" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="grid grid-cols-6 gap-1">{row0.map(topicButton)}</div>
        <div className="grid grid-cols-7 gap-1">{row1.map(topicButton)}</div>

        {/* ── 宫位标签：点一个多一个，各自独立，可单独关闭 ── */}
        {palaceTabs.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pt-1 pb-0.5" style={{ scrollbarWidth: 'thin' }}>
            {palaceTabs.map(p => {
              const isActive = active === p.key;
              const status = tabs[p.key]?.status;
              return (
                <div
                  key={p.key}
                  className="flex-shrink-0 flex items-center rounded-lg overflow-hidden"
                  style={{
                    background: isActive ? 'rgba(212,168,67,0.12)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(212,168,67,0.3)' : 'var(--t-border)'}`,
                  }}
                >
                  <button
                    onClick={() => switchTab(p.key)}
                    className="pl-2 pr-1 py-1 text-[10px] font-medium relative"
                    style={{ color: isActive ? 'var(--t-gold)' : 'var(--t-faint)', whiteSpace: 'nowrap' }}
                  >
                    {p.label}
                    {status === 'loading' && (
                      <span className="absolute top-0.5 right-0 w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--t-gold)' }} />
                    )}
                  </button>
                  <button
                    onClick={() => closePalaceTab(p.key)}
                    aria-label={`关闭${p.label}`}
                    className="px-1.5 py-1 text-[10px] leading-none"
                    style={{ color: 'var(--t-faint)', opacity: 0.7 }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 内容区（固定高度内部滚动）── */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {showThinking && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3" style={{ color: 'var(--t-gold)', opacity: 0.1 }}>✦</div>
            <p className="text-[10px] animate-pulse" style={{ color: 'var(--t-faint)' }}>
              {tab.reasoningChars > 0 ? `模型正在推理…（已思考 ${tab.reasoningChars} 字）` : '解读生成中…'}
            </p>
          </div>
        )}

        {!showThinking && tab.text && (
          <>
            <div className="text-[9px] tracking-widest mb-2 flex items-center gap-1.5" style={{ color: 'var(--t-faint)' }}>
              <span style={{ color: 'var(--t-gold)', opacity: 0.4 }}>✦</span>
              {palaceLabel ? `${palaceLabel} · 宫位分析` : '命理解读'}
            </div>
            <AiContent text={tab.text} streaming={loading} />
          </>
        )}

        {tab.status === 'error' && (
          <div
            className="mt-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed"
            style={{ background: 'rgba(212,120,67,0.07)', border: '1px solid rgba(212,120,67,0.25)', color: 'var(--t-text2)' }}
          >
            {tab.error}
          </div>
        )}
      </div>

      {/* ── 追问输入 ── */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={palaceLabel ? `继续问${palaceLabel}相关…` : '追问，如：今年适合换工作吗？'}
            disabled={loading}
            className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
            style={{
              background: 'var(--t-card)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-text)',
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(212,168,67,0.15)',
              border: '1px solid rgba(212,168,67,0.25)',
              color: 'var(--t-gold)',
            }}
          >
            {loading ? '…' : '追问'}
          </button>
        </div>
      </div>
    </div>
  );
}
