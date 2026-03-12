# 一、基础说明

## 1 API基础地址

```text
https://api.bilibili.com
```

所有 Web API 均基于该域名。

请求方式：

```text
GET
```

数据返回：

```text
JSON
```

典型返回结构：

```json
{
  "code": 0,
  "message": "0",
  "ttl": 1,
  "data": {}
}
```

说明：

| 字段      | 含义    |
| ------- | ----- |
| code    | 0表示成功 |
| message | 错误信息  |
| ttl     | 缓存时间  |
| data    | 实际数据  |

---

# 二、认证机制

部分 API 需要登录用户身份。

认证方式：

```text
cookie
```

关键 cookie：

```
SESSDATA
bili_jct
DedeUserID
```

浏览器登录后即可获取。

---

# 三、WBI签名机制

部分接口需要 **WBI签名**。

需要两个参数：

```
w_rid
wts
```

生成步骤：

1 获取 WBI key

```
https://api.bilibili.com/x/web-interface/nav
```

返回：

```
img_key
sub_key
```

2 拼接参数

3 计算 MD5

示例：

```
w_rid = md5(query + mixin_key)
```

注意：

以下 API 通常需要 WBI：

```
x/space/wbi/*
```

---

# 四、视频信息 API

## 1 获取视频详情

接口：

```
GET /x/web-interface/view
```

参数：

| 参数   | 说明  |
| ---- | --- |
| bvid | BV号 |
| aid  | AV号 |

示例：

```
https://api.bilibili.com/x/web-interface/view?bvid=BV1xx
```

返回关键字段：

```
data.title
data.pic
data.desc
data.owner.name
data.owner.mid
data.pubdate
data.stat.view
```

用途：

```
视频基础信息
UP信息
播放统计
```

---

## 2 获取视频统计

接口：

```
GET /x/web-interface/archive/stat
```

参数：

```
bvid
```

返回：

```
view
danmaku
reply
favorite
coin
share
```

用途：

```
视频热度分析
```

---

## 3 获取视频标签

接口：

```
GET /x/tag/archive/tags
```

参数：

```
bvid
```

返回：

```json
[
  {
    "tag_id": 123,
    "tag_name": "Python"
  }
]
```

用途：

```
视频标签系统
```

注意：

此 API **限速较低**，适合批量获取。

---

## 4 获取相关视频

接口：

```
GET /x/web-interface/archive/related
```

参数：

```
bvid
```

返回：

```
related videos
```

用途：

```
推荐图谱构建
```

---

# 五、收藏夹 API

## 1 获取用户收藏夹列表

接口：

```
GET /x/v3/fav/folder/created/list-all
```

参数：

```
up_mid
```

返回：

```
media_id
title
count
```

示例：

```
https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=123456
```

用途：

```
获取用户所有收藏夹
```

需要：

```
cookie
```

---

## 2 获取收藏夹视频

接口：

```
GET /x/v3/fav/resource/list
```

参数：

| 参数       | 说明    |
| -------- | ----- |
| media_id | 收藏夹ID |
| pn       | 页码    |
| ps       | 每页数量  |

示例：

```
https://api.bilibili.com/x/v3/fav/resource/list?media_id=xxx&pn=1&ps=20
```

返回：

```
bvid
title
cover
upper.name
upper.mid
pubtime
```

用途：

```
收藏视频同步
```

---

# 六、关注系统 API

## 1 获取关注列表

接口：

```
GET /x/relation/followings
```

参数：

```
vmid
pn
ps
```

返回：

```
mid
uname
face
```

用途：

```
获取关注UP
```

需要：

```
cookie
```

---

## 2 获取粉丝数量

接口：

```
GET /x/relation/stat
```

参数：

```
vmid
```

返回：

```
following
follower
```

用途：

```
UP统计
```

---

# 七、UP主视频 API

## 1 获取UP视频列表

接口：

```
GET /x/space/wbi/arc/search
```

参数：

| 参数  | 说明    |
| --- | ----- |
| mid | UP id |
| pn  | 页码    |
| ps  | 数量    |

示例：

```
https://api.bilibili.com/x/space/wbi/arc/search?mid=xxx&pn=1&ps=30
```

返回：

```
bvid
title
pic
pubdate
play
```

用途：

```
UP视频同步
```

注意：

```
需要WBI签名
```

---

# 八、搜索 API

## 1 综合搜索

接口：

```
GET /x/web-interface/search/all/v2
```

参数：

```
keyword
page
```

返回：

```
视频
UP
专栏
```

用途：

```
关键词采样
```

---

## 2 视频搜索

接口：

```
GET /x/web-interface/search/type
```

参数：

```
search_type=video
keyword
page
order
```

排序：

```
click
pubdate
dm
```

用途：

```
视频发现
```

---

# 九、分区 API

## 1 获取分区视频

接口：

```
GET /x/web-interface/dynamic/region
```

参数：

```
rid
pn
ps
```

返回：

```
视频列表
```

用途：

```
按分区采样视频
```

---

## 2 获取排行榜

接口：

```
GET /x/web-interface/ranking
```

参数：

```
rid
day
```

返回：

```
热门视频
```

用途：

```
热门数据分析
```

---

# 十、评论 API

接口：

```
GET /x/v2/reply/main
```

参数：

```
oid
type=1
```

返回：

```
评论列表
```

用途：

```
评论分析
```

---

# 十一、弹幕 API

接口：

```
GET /x/v1/dm/list.so
```

参数：

```
cid
```

返回：

```
XML弹幕
```

用途：

```
弹幕分析
```

---

# 十二、限速与风控

常见错误码：

| code | 含义   |
| ---- | ---- |
| 412  | 风控   |
| 429  | 请求过多 |
| -101 | 未登录  |

风控较高接口：

```
space/wbi/acc/info
relation API
```

风控较低接口：

```
view
tag
search
ranking
```

---

# 十三、推荐抓取策略

避免风控：

### 1 请求频率

推荐：

```
2~3 req/sec
```

UP接口：

```
1 req/sec
```

---

### 2 缓存机制

视频标签：

```
永久缓存
```

视频信息：

```
每日更新
```

UP视频：

```
最新50条
```

---

### 3 增量更新

只抓取：

```
新视频
```

避免全量扫描。

---

# 十四、推荐数据结构

用于构建标签管理系统：

```
videos
 ├ bvid
 ├ title
 ├ cover
 ├ up_mid
 ├ pubdate

tags
 ├ tag_id
 ├ tag_name

video_tag
 ├ bvid
 ├ tag_id

ups
 ├ mid
 ├ name
```

关系：

```
video -> tag
video -> up
```
