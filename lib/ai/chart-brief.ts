/**
 * 命盘 → 文本简报（喂给大模型的那一段「事实」）
 *
 * 只做一件事：把 ZiweiChart 这个结构化对象，压成模型能直接读的中文简报。
 * 不含任何论断——论断交给模型，事实必须来自引擎，避免模型编星曜。
 */

import 'server-only';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { detectPatterns } from '@/lib/ziwei/patterns';
import type { Palace, Star, ZiweiChart } from '@/lib/ziwei/types';

const SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const STAR_TYPE_LABEL: Record<Star['type'], string> = {
  major: '主星',
  lucky: '吉星',
  sha: '煞星',
  minor: '杂曜',
};

const PATTERN_LEVEL_LABEL = {
  excellent: '上格',
  good: '吉格',
  neutral: '中格',
  caution: '需留意',
} as const;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function starLabel(s: Star) {
  const brightness = s.brightnessRaw ? `(${s.brightnessRaw})` : '';
  const siHua = s.siHua ? `化${s.siHua}` : '';
  return `${s.name}${brightness}${siHua}`;
}

function palaceLine(p: Palace) {
  const groups = new Map<Star['type'], string[]>();
  for (const star of p.stars) {
    const list = groups.get(star.type) ?? [];
    list.push(starLabel(star));
    groups.set(star.type, list);
  }

  const parts: string[] = [`${p.name}｜${BRANCHES[p.branch]}（${STEMS[p.stem]}${BRANCHES[p.branch]}）`];

  for (const type of ['major', 'lucky', 'sha', 'minor'] as const) {
    const list = groups.get(type);
    if (list?.length) parts.push(`${STAR_TYPE_LABEL[type]}：${list.join('、')}`);
  }
  if (p.isEmpty) {
    const borrowed = p.borrowedStars?.join('、');
    parts.push(`空宫${borrowed ? `（借对宫 ${borrowed}）` : ''}`);
  }
  if (p.daXianAge) parts.push(`大限 ${p.daXianAge[0]}-${p.daXianAge[1]} 岁`);
  if (p.isMingGong) parts.push('【命宫】');
  if (p.isShenGong) parts.push('【身宫】');
  if (p.isCurrentDaXian) parts.push('【当前大限】');

  return `- ${parts.join('｜')}`;
}

/**
 * 单张命盘的文本简报。
 *
 * @param label 多张盘（合盘）时用来区分「甲方 / 乙方」
 */
export function buildChartBrief(chart: ZiweiChart, label?: string): string {
  const { birthInfo, lunarInfo } = chart;
  const hour = SHICHEN_NAMES[birthInfo.hour] ?? '子';
  const clock = birthInfo.origInput
    ? `（钟表 ${pad(birthInfo.origInput.clockHour)}:${pad(birthInfo.origInput.clockMinute)}` +
      `${birthInfo.origInput.day !== birthInfo.day ? '，已按晚子时换日' : ''}）`
    : '';

  const lines: string[] = [];
  lines.push(`${label ? `【${label}】` : '【命主】'}${birthInfo.gender === 'male' ? '男' : '女'}命`);
  lines.push(
    `- 公历 ${birthInfo.year}-${pad(birthInfo.month)}-${pad(birthInfo.day)} ${hour}时${clock}`,
  );

  const lunarMonth = `${lunarInfo.isLeapMonth ? '闰' : ''}${Math.abs(lunarInfo.lunarMonth)}`;
  lines.push(`- 农历 ${lunarInfo.lunarYear} 年 ${lunarMonth} 月 ${lunarInfo.lunarDay} 日`);
  if (lunarInfo.fourPillars?.length) {
    lines.push(`- 四柱（节气）${lunarInfo.fourPillars.join(' ')}`);
  }
  if (lunarInfo.fourPillarsLunar?.length) {
    lines.push(`- 四柱（农历口径，与紫微同历法）${lunarInfo.fourPillarsLunar.join(' ')}`);
  }

  const ming = chart.palaces.find(p => p.branch === chart.mingGongBranch);
  const shen = chart.palaces.find(p => p.branch === chart.shenGongBranch);
  lines.push(
    `- 命宫 ${BRANCHES[chart.mingGongBranch]}｜身宫 ${BRANCHES[chart.shenGongBranch]}` +
      `（命宫落「${ming?.name ?? '—'}」，身宫落「${shen?.name ?? '—'}」）`,
  );
  lines.push(
    `- ${chart.wuxingJuName}｜命主 ${chart.mingZhu ?? '—'}｜身主 ${chart.shenZhu ?? '—'}` +
      `｜${chart.yinYangGender ?? '—'}｜当前 ${chart.currentAge} 岁`,
  );

  const currentDx = chart.daXians[chart.currentDaXianIndex];
  if (currentDx) {
    const siHua = currentDx.siHua
      ? `，大限四化：${currentDx.siHua.stemName}干 ${currentDx.siHua.lu}化禄/${currentDx.siHua.quan}化权/${currentDx.siHua.ke}化科/${currentDx.siHua.ji}化忌`
      : '';
    lines.push(`- 当前大限 ${currentDx.startAge}-${currentDx.endAge} 岁（${currentDx.palaceName}）${siHua}`);
  }

  const patterns = detectPatterns(chart);
  if (patterns.length) {
    lines.push('- 已识别格局：');
    for (const p of patterns) {
      const level = PATTERN_LEVEL_LABEL[p.level] ?? p.level;
      const source = p.source ? `｜出处：${p.source}` : '';
      const palaces = p.palaces.length ? `｜涉及：${p.palaces.join('、')}` : '';
      lines.push(`  · ${p.name}（${level}）${p.description}${palaces}${source}`);
    }
  } else {
    lines.push('- 已识别格局：无（按单星与三方四正判断）');
  }

  lines.push('');
  lines.push('十二宫：');
  for (const palace of [...chart.palaces].sort((a, b) => a.branch - b.branch)) {
    lines.push(palaceLine(palace));
  }

  if (chart.daXians.length) {
    lines.push('');
    lines.push('大限走向：');
    lines.push(
      chart.daXians
        .map(d => `${d.startAge}-${d.endAge} 岁 ${d.palaceName}（${BRANCHES[d.palaceBranch]}）`)
        .join('；'),
    );
  }

  return lines.join('\n');
}
