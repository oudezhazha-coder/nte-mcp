/**
 * 初始化/更新异环数据缓存
 * 
 * 运行: npx tsx scripts/init-data.ts
 */

import { getCategoryMembers, getCharacter, searchWiki } from '../src/sources/bwiki.js';

async function main() {
  console.log('=== 异环数据初始化 ===\n');

  // 1. 获取角色列表并缓存
  console.log('📦 获取角色列表...');
  const members = await getCategoryMembers('角色');
  const valid = members.filter(m => !m.title.startsWith('模板') && !m.title.startsWith('预设'));
  console.log(`   ✅ 共 ${valid.length} 个角色\n`);

  // 2. 逐个缓存角色数据
  console.log('📦 缓存角色数据...');
  let success = 0;
  let failed = 0;

  for (const member of valid.slice(0, 5)) { // 先缓存前5个做演示
    console.log(`   🔄 正在获取: ${member.title}...`);
    const chara = await getCharacter(member.title);
    if (chara) {
      console.log(`   ✅ ${chara.name} (${chara.rarity} · ${chara.element})`);
      success++;
    } else {
      console.log(`   ❌ ${member.title} 获取失败`);
      failed++;
    }
  }

  // 3. 测试搜索
  console.log('\n📦 测试搜索...');
  const searchResults = await searchWiki('娜娜莉');
  console.log(`   ✅ 搜索 "娜娜莉" 找到 ${searchResults.length} 条结果`);

  console.log(`\n=== 初始化完成 ===`);
  console.log(`   角色缓存: ${success} 成功, ${failed} 失败`);
  console.log(`   运行 \`npm start\` 启动 MCP 服务`);
}

main().catch(console.error);