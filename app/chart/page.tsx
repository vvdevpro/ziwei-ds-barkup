'use client';
import { useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import SiteNav from '@/components/SiteNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, Palace, ZiweiChart } from '@/lib/ziwei/types';

/**
 * 命盘页 —— 排盘 + 解读。
 *
 * 排盘完全在浏览器里用本仓库的引擎完成（lib/ziwei），不需要任何 API Key。
 * AI 解读走 /api/interpret（见 app/api/interpret/route.ts），未配置模型时面板会明确报错。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);

  return (
    <>
      <SiteNav />

      {!chart ? (
        <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>紫微斗数排盘</h1>
          <p style={{ color: 'var(--tx-2)', marginBottom: 28, fontSize: 14, lineHeight: 1.7 }}>
            输入出生年月日时，即时生成命盘。
            <br />
            填了出生地会按经度 + 均时差做真太阳时校正，晚子时按真太阳时判断是否换日。
          </p>
          <BirthForm onSubmit={(info: BirthInfo) => setChart(generateChart(info))} />
        </main>
      ) : (
        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 16px 48px' }}>
          <button
            type="button"
            onClick={() => { setChart(null); setSelectedPalace(null); }}
            style={{
              marginBottom: 12, padding: '6px 14px', cursor: 'pointer',
              border: '1px solid var(--bdr-med)', borderRadius: 8,
              background: 'transparent', color: 'var(--tx-2)', fontSize: 13,
            }}
          >
            ← 重新起盘
          </button>

          <div
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
            style={{ gap: 20, alignItems: 'start' }}
          >
            <ChartBoard chart={chart} onPalaceSelect={setSelectedPalace} />
            <InsightPanel chart={chart} selectedPalace={selectedPalace} />
          </div>
        </main>
      )}
    </>
  );
}
