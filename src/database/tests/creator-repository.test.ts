/**
 * CreatorRepository 测试用例
 * 测试创作者相关的数据库操作
 */

import { test, assert } from './test-runner.js';
import { setupTestDatabase, cleanupTestDatabase } from './db-test-utils.js';
import { CreatorRepository } from '../implementations/creator-repository.impl.js';
import { Creator } from '../types/creator.js';
import { Platform, TagSource } from '../types/base.js';

test('upsertCreator should create or update a creator', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 创建测试数据
    const testCreator: Creator = {
      creatorId: 'test-creator-1',
      platform: Platform.BILIBILI,
      name: 'Test Creator',
      avatar: 'avatar.jpg',
      isLogout: 0,
      description: 'Test description',
      createdAt: Date.now(),
      followTime: Date.now(),
      isFollowing: 0,
      tagWeights: []
    };

    // 测试创建创作者
    await creatorRepository.upsertCreator(testCreator);

    // 验证创作者是否已创建
    const retrievedCreator = await creatorRepository.getCreator('test-creator-1', Platform.BILIBILI);
    assert(retrievedCreator !== null, 'Creator should be created');
    assert(retrievedCreator?.name === 'Test Creator', 'Creator name should match');

    // 测试更新创作者
    const updatedCreator = { ...testCreator, name: 'Updated Creator' };
    await creatorRepository.upsertCreator(updatedCreator);

    // 验证创作者是否已更新
    const retrievedUpdatedCreator = await creatorRepository.getCreator('test-creator-1', Platform.BILIBILI);
    assert(retrievedUpdatedCreator?.name === 'Updated Creator', 'Creator name should be updated');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});

test('upsertCreators should create or update multiple creators', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 创建测试数据
    const testCreators: Creator[] = [
      {
        creatorId: 'test-creator-1',
        platform: Platform.BILIBILI,
        name: 'Test Creator 1',
        avatar: 'avatar1.jpg',
        isLogout: 0,
        description: 'Test description 1',
        createdAt: Date.now(),
        followTime: Date.now(),
        isFollowing: 0,
        tagWeights: []
      },
      {
        creatorId: 'test-creator-2',
        platform: Platform.BILIBILI,
        name: 'Test Creator 2',
        avatar: 'avatar2.jpg',
        isLogout: 0,
        description: 'Test description 2',
        createdAt: Date.now(),
        followTime: Date.now(),
        isFollowing: 0,
        tagWeights: []
      }
    ];

    // 测试批量创建创作者
    await creatorRepository.upsertCreators(testCreators);

    // 验证创作者是否已创建
    const retrievedCreator1 = await creatorRepository.getCreator('test-creator-1', Platform.BILIBILI);
    const retrievedCreator2 = await creatorRepository.getCreator('test-creator-2', Platform.BILIBILI);

    assert(retrievedCreator1 !== null, 'Creator 1 should be created');
    assert(retrievedCreator2 !== null, 'Creator 2 should be created');
    assert(retrievedCreator1?.name === 'Test Creator 1', 'Creator 1 name should match');
    assert(retrievedCreator2?.name === 'Test Creator 2', 'Creator 2 name should match');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});

test('getCreator should return null for non-existent creator', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 测试获取不存在的创作者
    const nonExistentCreator = await creatorRepository.getCreator('non-existent', Platform.BILIBILI);
    assert(nonExistentCreator === null, 'Should return null for non-existent creator');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});

test('getFollowingCreators should return creators filtered by platform and sorted by followTime', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 创建测试数据
    const testCreators: Creator[] = [
      {
        creatorId: 'creator1',
        platform: Platform.BILIBILI,
        name: 'Creator 1',
        avatar: 'avatar1.jpg',
        isLogout: 0,
        description: 'Test creator 1',
        createdAt: Date.now() - 100000,
        followTime: Date.now() - 50000,
        isFollowing: 1,
        tagWeights: []
      },
      {
        creatorId: 'creator2',
        platform: Platform.BILIBILI,
        name: 'Creator 2',
        avatar: 'avatar2.jpg',
        isLogout: 0,
        description: 'Test creator 2',
        createdAt: Date.now() - 90000,
        followTime: Date.now() - 40000,
        isFollowing: 1,
        tagWeights: []
      },
      {
        creatorId: 'creator3',
        platform: Platform.BILIBILI,
        name: 'Creator 3',
        avatar: 'avatar3.jpg',
        isLogout: 0,
        description: 'Test creator 3',
        createdAt: Date.now() - 80000,
        followTime: Date.now() - 60000,
        isFollowing: 0,
        tagWeights: []
      },
      {
        creatorId: 'creator4',
        platform: Platform.YOUTUBE,
        name: 'Creator 4',
        avatar: 'avatar4.jpg',
        isLogout: 0,
        description: 'Test creator 4',
        createdAt: Date.now() - 70000,
        followTime: Date.now() - 30000,
        isFollowing: 1,
        tagWeights: []
      }
    ];

    // 添加测试数据到数据库
    await creatorRepository.upsertCreators(testCreators);

    // 测试获取 BILIBILI 平台关注的创作者
    const bilibiliCreators = await creatorRepository.getFollowingCreators(Platform.BILIBILI);

    // 验证结果
    assert(bilibiliCreators.length === 2, 'Should return 2 creators for BILIBILI platform');
    assert(bilibiliCreators[0].creatorId === 'creator2', 'First creator should be creator2 (newest followTime)');
    assert(bilibiliCreators[1].creatorId === 'creator1', 'Second creator should be creator1 (older followTime)');

    // 测试获取 YOUTUBE 平台关注的创作者
    const arcopenCreators = await creatorRepository.getFollowingCreators(Platform.YOUTUBE);

    // 验证结果
    assert(arcopenCreators.length === 1, 'Should return 1 creator for YOUTUBE platform');
    assert(arcopenCreators[0].creatorId === 'creator4', 'Creator should be creator4');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});

test('updateFollowStatus should update creator follow status', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 创建测试数据
    const testCreator: Creator = {
      creatorId: 'test-creator-1',
      platform: Platform.BILIBILI,
      name: 'Test Creator',
      avatar: 'avatar.jpg',
      isLogout: 0,
      description: 'Test description',
      createdAt: Date.now(),
      followTime: Date.now(),
      isFollowing: 0,
      tagWeights: []
    };

    // 添加测试数据到数据库
    await creatorRepository.upsertCreator(testCreator);

    // 测试更新关注状态
    await creatorRepository.updateFollowStatus('test-creator-1', Platform.BILIBILI, 1);

    // 验证关注状态是否已更新
    const updatedCreator = await creatorRepository.getCreator('test-creator-1', Platform.BILIBILI);
    assert(updatedCreator?.isFollowing === 1, 'Follow status should be updated to 1');
    assert(updatedCreator?.followTime !== undefined && updatedCreator.followTime > testCreator.followTime, 'Follow time should be updated');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});

test('updateTagWeights should update creator tag weights', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 创建测试数据
    const testCreator: Creator = {
      creatorId: 'test-creator-1',
      platform: Platform.BILIBILI,
      name: 'Test Creator',
      avatar: 'avatar.jpg',
      isLogout: 0,
      description: 'Test description',
      createdAt: Date.now(),
      followTime: Date.now(),
      isFollowing: 0,
      tagWeights: [
        {
          tagId: 'tag1',
          source: TagSource.SYSTEM,
          count: 5,
          createdAt: Date.now()
        }
      ]
    };

    // 添加测试数据到数据库
    await creatorRepository.upsertCreator(testCreator);

    // 测试更新标签权重
    const newTagWeights = [
      {
        tagId: 'tag1',
        source: TagSource.SYSTEM,
        count: 3,
        createdAt: Date.now()
      },
      {
        tagId: 'tag2',
        source: TagSource.USER,
        count: 0,
        createdAt: Date.now()
      }
    ];

    await creatorRepository.updateTagWeights('test-creator-1', Platform.BILIBILI, newTagWeights);

    // 验证标签权重是否已更新
    const updatedCreator = await creatorRepository.getCreator('test-creator-1', Platform.BILIBILI);
    assert(updatedCreator?.tagWeights.length === 2, 'Should have 2 tag weights');

    const tag1 = updatedCreator?.tagWeights.find(tw => tw.tagId === 'tag1');
    const tag2 = updatedCreator?.tagWeights.find(tw => tw.tagId === 'tag2');

    assert(tag1?.count === 8, 'Tag1 count should be 8 (5 + 3)');
    assert(tag2?.count === 0, 'Tag2 count should be 0');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});

test('searchCreators should return creators matching the keyword', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 创建测试数据
    const testCreators: Creator[] = [
      {
        creatorId: 'creator1',
        platform: Platform.BILIBILI,
        name: 'Test Creator 1',
        avatar: 'avatar1.jpg',
        isLogout: 0,
        description: 'Test description 1',
        createdAt: Date.now(),
        followTime: Date.now(),
        isFollowing: 0,
        tagWeights: []
      },
      {
        creatorId: 'creator2',
        platform: Platform.BILIBILI,
        name: 'Another Creator',
        avatar: 'avatar2.jpg',
        isLogout: 0,
        description: 'Test description 2',
        createdAt: Date.now(),
        followTime: Date.now(),
        isFollowing: 0,
        tagWeights: []
      },
      {
        creatorId: 'creator3',
        platform: Platform.YOUTUBE,
        name: 'Test Creator 3',
        avatar: 'avatar3.jpg',
        isLogout: 0,
        description: 'Test description 3',
        createdAt: Date.now(),
        followTime: Date.now(),
        isFollowing: 0,
        tagWeights: []
      }
    ];

    // 添加测试数据到数据库
    await creatorRepository.upsertCreators(testCreators);

    // 测试搜索创作者
    const result = await creatorRepository.searchCreators(
      Platform.BILIBILI,
      'test',
      { page: 0, pageSize: 10 }
    );

    // 验证结果
    assert(result.items.length === 1, 'Should return 1 creator matching "test"');
    assert(result.items[0].creatorId === 'creator1', 'Should return creator1');
    assert(result.total === 1, 'Total should be 1');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});

test('deleteCreator should delete a creator', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 创建测试数据
    const testCreator: Creator = {
      creatorId: 'test-creator-1',
      platform: Platform.BILIBILI,
      name: 'Test Creator',
      avatar: 'avatar.jpg',
      isLogout: 0,
      description: 'Test description',
      createdAt: Date.now(),
      followTime: Date.now(),
      isFollowing: 0,
      tagWeights: []
    };

    // 添加测试数据到数据库
    await creatorRepository.upsertCreator(testCreator);

    // 验证创作者是否已创建
    const retrievedCreator = await creatorRepository.getCreator('test-creator-1', Platform.BILIBILI);
    assert(retrievedCreator !== null, 'Creator should be created');

    // 测试删除创作者
    await creatorRepository.deleteCreator('test-creator-1', Platform.BILIBILI);

    // 验证创作者是否已删除
    const deletedCreator = await creatorRepository.getCreator('test-creator-1', Platform.BILIBILI);
    assert(deletedCreator === null, 'Creator should be deleted');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});

test('markCreatorAsLogout should mark a creator as logged out', async () => {
  const dbManager = await setupTestDatabase();

  try {
    const creatorRepository = new CreatorRepository();

    // 创建测试数据
    const testCreator: Creator = {
      creatorId: 'test-creator-1',
      platform: Platform.BILIBILI,
      name: 'Test Creator',
      avatar: 'avatar.jpg',
      isLogout: 0,
      description: 'Test description',
      createdAt: Date.now(),
      followTime: Date.now(),
      isFollowing: 0,
      tagWeights: []
    };

    // 添加测试数据到数据库
    await creatorRepository.upsertCreator(testCreator);

    // 测试标记创作者为已注销
    await creatorRepository.markCreatorAsLogout('test-creator-1', Platform.BILIBILI);

    // 验证创作者是否已标记为已注销
    const updatedCreator = await creatorRepository.getCreator('test-creator-1', Platform.BILIBILI);
    assert(updatedCreator?.isLogout === 1, 'Creator should be marked as logged out');
  } finally {
    await cleanupTestDatabase(dbManager);
  }
});
