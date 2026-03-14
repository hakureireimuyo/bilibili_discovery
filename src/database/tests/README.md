# 数据库测试指南

本目录包含数据库相关的测试工具和测试用例，用于在非浏览器环境中测试数据库操作。

## 前置条件

1. 安装项目依赖：
```bash
npm install
```

2. 确保 `fake-indexeddb` 已安装（已在 package.json 中配置）：
```bash
npm install
```

## 运行测试

### 运行所有数据库测试

```bash
npm run test:db
```

## 测试工具

### db-test-utils.ts

提供以下工具函数：

- `initTestEnvironment()`: 初始化测试环境，使用 fake-indexeddb 替代浏览器环境的 IndexedDB
- `setupTestDatabase()`: 设置测试数据库，创建一个独立的测试数据库实例
- `cleanupTestDatabase(dbManager)`: 清理测试数据库，删除测试数据库并关闭连接
- `resetTestDatabase(dbManager)`: 重置测试数据库，删除所有数据但保留数据库结构

### test-runner.ts

提供以下工具函数：

- `test(name, run)`: 定义一个测试用例
- `assert(condition, message)`: 断言条件为真，否则抛出错误
- `runTests()`: 运行所有已定义的测试用例

## 测试用例

### creator-repository.test.ts

包含 CreatorRepository 相关的测试用例：

- `upsertCreator should create or update a creator`: 测试创建或更新创作者
- `upsertCreators should create or update multiple creators`: 测试批量创建或更新创作者
- `getCreator should return null for non-existent creator`: 测试获取不存在的创作者
- `getFollowingCreators should return creators filtered by platform and sorted by followTime`: 测试获取关注的创作者功能
- `updateFollowStatus should update creator follow status`: 测试更新创作者关注状态
- `updateTagWeights should update creator tag weights`: 测试更新创作者标签权重
- `searchCreators should return creators matching the keyword`: 测试搜索创作者
- `deleteCreator should delete a creator`: 测试删除创作者

## 添加新测试

1. 在 `src/database/tests/` 目录下创建新的测试文件，文件名以 `.test.ts` 结尾
2. 使用 `test` 函数定义测试用例
3. 使用 `assert` 函数进行断言
4. 使用 `setupTestDatabase` 和 `cleanupTestDatabase` 设置和清理测试环境

示例：

```typescript
import { test, assert } from './test-runner';
import { setupTestDatabase, cleanupTestDatabase } from './db-test-utils';

test('my test case', async () => {
  const dbManager = await setupTestDatabase();

  try {
    // 测试代码
    assert(condition, 'Error message');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});
```

## 注意事项

1. 每个测试用例应该独立运行，不依赖于其他测试用例的状态
2. 使用 `setupTestDatabase` 和 `cleanupTestDatabase` 确保每个测试用例在干净的环境中运行
3. 测试完成后，确保清理所有资源，避免影响其他测试用例
4. 测试环境使用 `fake-indexeddb` 模拟浏览器环境的 IndexedDB，与真实环境可能有细微差异
