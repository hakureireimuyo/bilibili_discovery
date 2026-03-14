/**
 * API数据获取测试
 * 用于测试B站API是否能成功获取数据
 * 直接使用Node.js运行，无需编译
 */

import {
  getWBIKeys,
  generateWBISign,
  getVideoTags,
  getUPVideos,
  __resetRateLimiter
} from "../dist/src/api/bili-api.js";

// 测试用的UP主ID（可以替换成你想测试的UP主ID）
const TEST_UP_ID = 62351857; // 示例UP主ID

/**
 * 测试WBI密钥获取
 */
async function testWBIKeys() {
  console.log("\n=== 测试WBI密钥获取 ===");
  try {
    const keys = await getWBIKeys();
    if (keys) {
      console.log("✓ WBI密钥获取成功");
      console.log("  img_key:", keys.img_key.substring(0, 10) + "...");
      console.log("  sub_key:", keys.sub_key.substring(0, 10) + "...");
      console.log("  mixin_key:", keys.mixin_key.substring(0, 10) + "...");
      return keys;
    } else {
      console.log("✗ WBI密钥获取失败");
      return null;
    }
  } catch (error) {
    console.error("✗ WBI密钥获取出错:", error);
    return null;
  }
}

/**
 * 测试WBI签名生成
 */
async function testWBISign() {
  console.log("\n=== 测试WBI签名生成 ===");
  try {
    const sign = await generateWBISign({ mid: TEST_UP_ID, pn: 1, ps: 30 });
    if (sign) {
      console.log("✓ WBI签名生成成功");
      console.log("  w_rid:", sign.w_rid);
      console.log("  wts:", sign.wts);
      return sign;
    } else {
      console.log("✗ WBI签名生成失败");
      return null;
    }
  } catch (error) {
    console.error("✗ WBI签名生成出错:", error);
    return null;
  }
}

/**
 * 测试获取视频标签
 */
async function testVideoTags(bvid) {
  console.log("\n=== 测试获取视频标签 ===");
  console.log(`BV号: ${bvid}`);
  try {
    const tags = await getVideoTags(bvid);
    if (tags && tags.length > 0) {
      console.log(`✓ 成功获取 ${tags.length} 个标签`);
      console.log("标签列表:", tags.join(", "));
      return tags;
    } else {
      console.log("✗ 标签获取失败或视频没有标签");
      return [];
    }
  } catch (error) {
    console.error("✗ 标签获取出错:", error);
    return [];
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log("========================================");
  console.log("  B站API数据获取测试");
  console.log("========================================");

  // 重置速率限制器
  __resetRateLimiter();

  // 测试1: WBI密钥获取
  const wbiKeys = await testWBIKeys();
  if (!wbiKeys) {
    console.log("\n✗ WBI密钥获取失败，后续测试可能无法进行");
    return;
  }

  // 测试2: WBI签名生成
  const sign = await testWBISign();
  if (!sign) {
    console.log("\n✗ WBI签名生成失败，后续测试可能无法进行");
    return;
  }

  // 跳过UP信息获取测试，直接测试视频获取

  // 测试3: 获取UP视频（不使用WBI签名）
  console.log("\n=== 测试获取UP视频（不使用WBI签名） ===");
  console.log(`UP主ID: ${TEST_UP_ID}`);
  try {
    const videos = await getUPVideos(TEST_UP_ID);
    if (videos && videos.length > 0) {
      console.log(`✓ 成功获取 ${videos.length} 个视频`);
      console.log("\n视频列表:");
      videos.slice(0, 5).forEach((video, index) => {
        console.log(`\n${index + 1}. ${video.title}`);
        console.log(`   BV号: ${video.bvid}`);
        console.log(`   播放量: ${video.play}`);
        console.log(`   时长: ${video.duration}秒`);
      });
    } else {
      console.log("✗ 视频获取失败或UP主没有视频");
    }
  } catch (error) {
    console.error("✗ 视频获取出错:", error);
  }

  // 测试4: 获取第一个视频的标签
  const testVideos = await getUPVideos(TEST_UP_ID);
  if (testVideos && testVideos.length > 0) {
    await testVideoTags(testVideos[0].bvid);
  } else {
    console.log("\n✗ 无法获取视频，无法测试标签获取");
  }

  console.log("\n========================================");
  console.log("  测试完成");
  console.log("========================================");
}

// 运行测试
runAllTests().catch(error => {
  console.error("测试运行出错:", error);
  process.exit(1);
});
