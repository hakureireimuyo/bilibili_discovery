# 标签逻辑表达式使用示例

## 概述

标签逻辑表达式允许您通过从左到右依次执行简单的逻辑运算来实现复杂的标签查询。每个表达式的结果将作为下一个表达式的输入。

## 支持的操作符

### AND（与）
必须包含所有指定的标签。

```typescript
{
  operator: 'and',
  tagIds: ['tag1', 'tag2']
}
```

### OR（或）
至少包含其中一个标签。

```typescript
{
  operator: 'or',
  tagIds: ['tag1', 'tag2', 'tag3']
}
```

### NOT（非）
不包含任何指定的标签。

```typescript
{
  operator: 'not',
  tagIds: ['tag1']
}
```

## 使用示例

### 示例1：简单的AND查询
查找同时包含"游戏"和"音乐"标签的UP主。

```typescript
const result = await searchCreators('bilibili', {
  tagExpressions: [
    {
      operator: 'and',
      tagIds: ['游戏', '音乐']
    }
  ]
});
```

### 示例2：简单的OR查询
查找包含"游戏"或"音乐"标签的UP主。

```typescript
const result = await searchCreators('bilibili', {
  tagExpressions: [
    {
      operator: 'or',
      tagIds: ['游戏', '音乐']
    }
  ]
});
```

### 示例3：组合查询 - (A OR B) AND (NOT C)
查找包含"游戏"或"音乐"标签，但不包含"广告"标签的UP主。

```typescript
const result = await searchCreators('bilibili', {
  tagExpressions: [
    {
      operator: 'or',
      tagIds: ['游戏', '音乐']
    },
    {
      operator: 'not',
      tagIds: ['广告']
    }
  ]
});
```

### 示例4：复杂组合查询
查找包含"游戏"或"音乐"标签，同时包含"高清"标签，但不包含"广告"和"搬运"标签的UP主。

```typescript
const result = await searchCreators('bilibili', {
  tagExpressions: [
    {
      operator: 'or',
      tagIds: ['游戏', '音乐']
    },
    {
      operator: 'and',
      tagIds: ['高清']
    },
    {
      operator: 'not',
      tagIds: ['广告', '搬运']
    }
  ]
});
```

### 示例5：结合其他查询条件
查找已关注的、包含"游戏"或"音乐"标签的UP主，按更新时间排序。

```typescript
const result = await searchCreators('bilibili', {
  isFollowing: true,
  tagExpressions: [
    {
      operator: 'or',
      tagIds: ['游戏', '音乐']
    }
  ],
  page: 0,
  pageSize: 20
});
```

## 执行顺序说明

表达式从左到右依次执行，每个表达式的结果作为下一个表达式的输入。例如：

```typescript
tagExpressions: [
  { operator: 'or', tagIds: ['A', 'B'] },    // 步骤1：获取包含A或B的UP主
  { operator: 'and', tagIds: ['C'] },        // 步骤2：从步骤1的结果中，筛选同时包含C的UP主
  { operator: 'not', tagIds: ['D'] }         // 步骤3：从步骤2的结果中，排除包含D的UP主
]
```

这等价于逻辑表达式：`(A OR B) AND C AND NOT D`

## 注意事项

1. 标签ID应该是字符串类型，使用实际的标签ID而不是标签名称
2. 标签名称仅在UI层显示时使用
3. 空的 `tagIds` 数组会被忽略
4. 表达式按顺序执行，顺序会影响最终结果
5. 如果所有表达式都不匹配，将返回空列表
