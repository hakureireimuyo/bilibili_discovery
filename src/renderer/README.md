
# 渲染书 (RenderBook)

渲染书是介于数据层和UI层之间的中间层，负责将数据对象转换为网页元素，并实现分页和缓存功能。

## 设计理念

渲染书的核心设计理念是**关注点分离**、**职责单一**和**单一真相源**：

1. **Book**：负责与数据库和查询服务交互，提供完整的数据对象和分页数据，是配置的唯一真相源
2. **IElementBuilder**：接收完整数据对象，实现网页元素对象的生成
3. **RenderBook**：负责实现网页元素对象的分页化，缓存网页元素以提高查看流畅度
4. **RenderList**：从渲染书获得网页元素，将元素渲染成列表，提供翻页交互，并管理所有元素

### 配置同步机制

渲染书的配置与Book保持完全同步：
- 渲染书不维护自己的状态，而是通过getter直接从Book获取状态
- 所有修改配置的方法（如updateIndex）都直接转发给Book
- Book作为唯一真相源，确保数据层和渲染层配置的一致性

### 观察者模式

渲染书实现了观察者模式，当Book更新索引时自动通知渲染书：
- 渲染书实现了`IIndexUpdateListener`接口
- 在构造函数中自动注册为Book的索引更新监听器
- 当Book更新索引时，会自动通知所有注册的监听器
- 渲染书接收到更新通知后，会清除所有缓存的渲染页
- 在销毁渲染书时，会自动取消注册监听器，避免内存泄漏

这种反向传播机制确保了：
1. 渲染书不需要主动轮询Book的状态变化
2. 不引入不必要的依赖关系
3. Book作为唯一真相源，控制所有更新通知
4. 渲染书可以及时响应索引更新，保持数据一致性

## 核心功能

### RenderBook
- **数据转换**：将Book中的数据对象通过IElementBuilder转换为网页元素
- **分页显示**：实现网页元素的分页显示，与Book的分页保持一致
- **缓存管理**：缓存最多三页的网页元素，优先保留当前页及其相邻页
- **生命周期管理**：只负责交付元素对象，不管理元素对象的生命周期

### RenderList
- **元素渲染**：从渲染书获取网页元素并渲染成列表
- **翻页交互**：提供翻页功能，包括上一页、下一页和跳转到指定页
- **元素管理**：管理所有元素，包括对元素的细微操作
- **更新通知**：接收渲染书的更新通知，实现最终的更新

## 使用示例

### RenderBook 使用示例

```typescript
import { RenderBook } from './renderer/index.js';
import type { IElementBuilder } from './renderer/index.js';

// 1. 实现元素构建器
class VideoElementBuilder implements IElementBuilder<Video, HTMLElement> {
  buildElement(data: Video): HTMLElement {
    const element = document.createElement('div');
    element.className = 'video-item';
    element.innerHTML = `
      <h3>${data.title}</h3>
      <p>UP主: ${data.uploader}</p>
    `;
    return element;
  }

  buildElements(dataList: Video[]): HTMLElement[] {
    return dataList.map(data => this.buildElement(data));
  }
}

// 2. 创建渲染书
const renderBook = new RenderBook({
  book: bookInstance,
  elementBuilder: new VideoElementBuilder(),
  maxCachePages: 3
});

// 3. 获取渲染页数据
const result = await renderBook.getPage(0, { pageSize: 20 });
console.log(result.elements); // 网页元素列表
console.log(result.state);    // 分页状态

// 4. 更新索引（会自动通知渲染书）
await renderBook.updateIndex(newCondition);

// 5. 销毁渲染书（取消注册监听器）
renderBook.destroy();
```

### RenderList 使用示例

```typescript
import { RenderList } from './renderer/index.js';

// 1. 实现渲染列表子类
class VideoRenderList extends RenderList<Video, HTMLElement> {
  protected renderElements(elements: HTMLElement[]): void {
    this.container.innerHTML = '';
    elements.forEach(element => {
      this.container.appendChild(element);
    });
  }

  protected async deleteElement(element: HTMLElement, data: Video): Promise<void> {
    // 从DOM中移除元素
    this.container.removeChild(element);

    // 调用repository的删除方法更新数据库和缓存层
    await videoRepository.delete(data.id);
  }
}

// 2. 创建渲染列表
const container = document.getElementById('video-list') as HTMLElement;
const renderList = new VideoRenderList({
  renderBook: renderBookInstance,
  container: container,
  autoRender: true
});

// 3. 渲染当前页
await renderList.renderCurrentPage();

// 4. 翻页
await renderList.nextPage();
await renderList.previousPage();
await renderList.goToPage(2);

// 5. 销毁渲染列表（取消注册监听器）
renderList.destroy();
```

## 类型定义

### IElementBuilder<TData, TElement>

元素构建器接口，定义必须实现的方法：

- `buildElement(data: TData): TElement` - 将单个数据对象转换为网页元素
- `buildElements(dataList: TData[]): TElement[]` - 批量转换数据对象
- `updateElement?(element: TElement, data: TData): void` - 更新已有的网页元素（可选）

### RenderBookConfig<TData, TElement>

渲染书配置接口：

- `book: Book<TData>` - 书实例
- `elementBuilder: IElementBuilder<TData, TElement>` - 元素构建器
- `maxCachePages?: number` - 最大缓存页数，默认为3

### RenderQueryResult<TElement>

渲染书查询结果：

- `elements: TElement[]` - 当前页网页元素
- `state: BookPageState` - 分页状态
- `bookId: number` - 书的ID

### IRenderListUpdateListener

渲染列表更新监听器接口：

- `onRenderBookUpdate(bookId: number): void` - 处理渲染书更新事件

### RenderListConfig<TData, TElement>

渲染列表配置接口：

- `renderBook: RenderBook<TData, TElement>` - 渲染书实例
- `container: HTMLElement` - 容器元素
- `autoRender?: boolean` - 是否自动渲染，默认为true

### RenderList<TData, TElement>

渲染列表抽象类，定义了以下核心方法：

- `renderCurrentPage(): Promise<void>` - 渲染当前页
- `renderPage(page: number, options?: BookQueryOptions): Promise<void>` - 渲染指定页
- `nextPage(): Promise<void>` - 翻到下一页
- `previousPage(): Promise<void>` - 翻到上一页
- `goToPage(page: number): Promise<void>` - 翻到指定页
- `getCurrentElements(): TElement[]` - 获取当前元素列表
- `getCurrentPage(): number` - 获取当前页码
- `getTotalPages(): number` - 获取总页数
- `destroy(): void` - 销毁渲染列表

子类必须实现以下抽象方法：

- `renderElements(elements: TElement[]): void` - 渲染元素列表
- `deleteElement(element: TElement, data: TData): Promise<void>` - 删除元素

## 注意事项

1. 渲染书不管理元素对象的生命周期，调用者需要负责元素对象的创建和销毁
2. 渲染书的缓存策略是优先保留当前页及其相邻页，最多缓存maxCachePages页
3. 当Book更新索引时，渲染书会自动清除所有缓存的渲染页
4. 渲染书与Book共享相同的分页状态，确保数据一致性
5. 渲染书的配置与Book保持完全同步，Book是配置的唯一真相源
6. 所有修改配置的方法都直接转发给Book，确保数据层和渲染层配置的一致性
7. 渲染书在构造函数中自动注册为Book的监听器，在销毁时自动取消注册
8. 当不再需要渲染书时，必须调用destroy()方法，避免内存泄漏
