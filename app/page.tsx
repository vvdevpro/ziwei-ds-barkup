import { permanentRedirect } from 'next/navigation';

/**
 * 首页 —— 直接进排盘。
 *
 * 原本的营销落地页（滚动叙事、公告弹窗、限时活动、倪师生平介绍）已移除：
 * 这里保留的是能直接用的功能，不是一个招商页。要做落地页请在自己分支里改回来。
 */
export default function HomePage() {
  permanentRedirect('/chart');
}
