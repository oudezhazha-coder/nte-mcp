/**
 * 异环抽卡模拟器
 *
 * 基于真实抽卡概率机制：
 *   - S 角色基础概率 0.99%
 *   - 90 抽硬保底（无 50/50，出 S 必是当期 UP）
 *   - 软保底从 71 抽开始，每抽 +5%，到 90 抽 100%
 *   - 每 10 抽保底 1 个 A 或以上
 *
 * @see https://neverness.gg/neverness-to-everness-gacha-system-pity
 * @see https://gamewith.net/nte/74098
 */

// ─── 概率常量 ──────────────────────────────────────────────────

/** S 基础概率 0.99% */
const S_BASE_RATE = 0.0099;
/** 71 抽起进入软保底 */
const SOFT_PITY_START = 71;
/** 软保底每抽提升 5%（71→5.99%、76→30.99%、81→55.99%、86→80.99%、90→100%） */
const SOFT_PITY_INCREMENT = 0.05;
/** 90 抽硬保底 */
const HARD_PITY = 90;
/** A+ 总概率（含 S），实际 A 概率 ≈ 8% */
const A_RATE_BASE = 0.09;

// ─── 角色池 ────────────────────────────────────────────────────

export const S_CHARACTERS = [
  '九原', '伊洛伊', '卡厄斯', '哈索尔', '塔吉多',
  '娜娜莉', '安魂曲', '小吱', '早雾', '明音凛',
  '残虹', '法帝娅', '浔', '灵可', '白藏',
  '真红', '达芙蒂尔', '零', '黑羽',
];

export const A_CHARACTERS = [
  '哈尼娅', '埃德嘉', '海月', '翳', '薄荷', '阿德勒',
];

/** B 级掉落素材池 */
const B_ITEMS = [
  '纬核', '极限齿轮·Ω', '透镜石', '随机弧盘',
  '信用点×10,000', '遗迹刻印', '因果残片',
];

// ─── 保底追踪 ──────────────────────────────────────────────────

type PityState = { limited: number; standard: number };
const pityMap = new Map<number, PityState>();

function getPity(userId: number): PityState {
  if (!pityMap.has(userId)) {
    pityMap.set(userId, { limited: 0, standard: 0 });
  }
  return pityMap.get(userId)!;
}

// ─── 抽卡类型 ──────────────────────────────────────────────────

export type Rarity = 'S' | 'A' | 'B';
export type BannerType = 'limited' | 'standard';

export interface PullResult {
  rarity: Rarity;
  name: string;
  isFeatured?: boolean;
  pityCount: number;
}

export interface PullSummary {
  pulls: PullResult[];
  totalS: number;
  totalA: number;
  totalB: number;
  currentPity: number;
}

// ─── 概率计算 ──────────────────────────────────────────────────

/**
 * 根据当前第几抽计算实际 S 概率
 */
function calcSRate(pullNumber: number): number {
  if (pullNumber >= HARD_PITY) return 1.0;
  if (pullNumber >= SOFT_PITY_START) {
    const extra = (pullNumber - SOFT_PITY_START + 1) * SOFT_PITY_INCREMENT;
    return Math.min(S_BASE_RATE + extra, 1.0);
  }
  return S_BASE_RATE;
}

// ─── 核心算法 ──────────────────────────────────────────────────

/**
 * 单次抽卡
 * @param pityBefore 抽之前的累计保底数
 * @param bannerType limited/standard
 * @param featured 限定 UP 角色（limited 时使用，standard 时忽略）
 */
function singlePull(
  pityBefore: number,
  bannerType: BannerType,
  featured: string,
): PullResult {
  const pullNum = pityBefore + 1;
  const sRate = calcSRate(pullNum);
  const roll = Math.random();

  // 出 S
  if (roll < sRate) {
    let name: string;
    let isFeatured: boolean;

    if (bannerType === 'limited') {
      // 限定池：必定 UP
      name = featured;
      isFeatured = true;
    } else {
      // 常驻池：从所有 S 中随机
      name = S_CHARACTERS[Math.floor(Math.random() * S_CHARACTERS.length)];
      isFeatured = false;
    }

    return { rarity: 'S', name, isFeatured, pityCount: pullNum };
  }

  // 出 A（排除已判定的 S）
  const aRate = A_RATE_BASE - S_BASE_RATE < 0.01 ? 0.08 : A_RATE_BASE;
  if (roll < sRate + aRate) {
    const name = A_CHARACTERS[Math.floor(Math.random() * A_CHARACTERS.length)];
    return { rarity: 'A', name, pityCount: pullNum };
  }

  // 出 B
  const name = B_ITEMS[Math.floor(Math.random() * B_ITEMS.length)];
  return { rarity: 'B', name, pityCount: pullNum };
}

/**
 * 执行抽卡
 * @param userId 用户 ID（保底追踪）
 * @param count 1 或 10
 * @param featured 限定 UP 角色
 * @param bannerType limited / standard
 */
export function simulate(
  userId: number,
  count: 1 | 10,
  featured: string = '黑羽',
  bannerType: BannerType = 'limited',
): PullSummary {
  const pity = getPity(userId);
  const key = bannerType === 'limited' ? 'limited' : 'standard';
  let currentPity = pity[key];
  const results: PullResult[] = [];

  for (let i = 0; i < count; i++) {
    const result = singlePull(currentPity, bannerType, featured);
    currentPity = result.rarity === 'S' ? 0 : currentPity + 1;
    results.push(result);
  }

  // 10 连 A 保底
  if (count === 10) {
    const hasAOrAbove = results.some(r => r.rarity === 'S' || r.rarity === 'A');
    if (!hasAOrAbove) {
      const aName = A_CHARACTERS[Math.floor(Math.random() * A_CHARACTERS.length)];
      const last = results[results.length - 1];
      results[results.length - 1] = { ...last, rarity: 'A', name: aName };
    }
  }

  // 最后出 S 则重置保底
  const lastS = [...results].reverse().find(r => r.rarity === 'S');
  pity[key] = lastS ? 0 : currentPity;

  return {
    pulls: results,
    totalS: results.filter(r => r.rarity === 'S').length,
    totalA: results.filter(r => r.rarity === 'A').length,
    totalB: results.filter(r => r.rarity === 'B').length,
    currentPity: pity[key],
  };
}

// ─── 格式化输出 ────────────────────────────────────────────────

const EMOJI: Record<Rarity, string> = { S: '🌟', A: '⭐', B: '🔹' };

export function formatPullResult(
  summary: PullSummary,
  featured: string,
  bannerType: BannerType = 'limited',
): string {
  const lines: string[] = [];

  if (bannerType === 'standard') {
    lines.push('🎲 异环抽卡 · 常驻池\n');
    lines.push('📢 常驻角色池，所有 S 角色等概率');
  } else {
    lines.push('🎲 异环抽卡 · 限定UP\n');
    lines.push(`📢 当期 UP：${featured}（出 S 必是 UP）`);
  }

  lines.push('📊 概率：S=0.99% | A≈8% | 71抽软保底 | 90抽硬保底');
  lines.push(`📦 保底进度：${summary.currentPity} / 90 抽\n`);

  // 软保底进度条
  if (summary.currentPity >= 70) {
    const pct = Math.min((summary.currentPity - 70) / 20 * 100, 100);
    const barLen = Math.floor(pct / 10);
    const bar = '█'.repeat(barLen) + '░'.repeat(10 - barLen);
    lines.push(`⚠️ 软保底中！概率已提升至 ~${Math.round(pct)}%\n`);
    lines.push(`  ${bar}\n`);
  }

  lines.push('━━━ 抽卡结果 ━━━\n');

  for (const p of summary.pulls) {
    const emoji = EMOJI[p.rarity];
    const featLabel = p.isFeatured ? ' 🏆UP' : '';
    lines.push(`  ${emoji} [${p.rarity}] ${p.name}${featLabel}`);
  }

  lines.push('\n━━━━━━━━━━━━━');
  if (summary.totalS > 0) lines.push(`🏆 出货！S 级 ×${summary.totalS}`);
  if (summary.totalA > 0) lines.push(`⭐ A 级 ×${summary.totalA}`);
  if (summary.totalB > 0) lines.push(`🔹 其他 ×${summary.totalB}`);

  lines.push(`\n💡 发送"异环抽卡"再来十连！`);
  return lines.join('\n');
}