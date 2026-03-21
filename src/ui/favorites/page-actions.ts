import type { FavoritesState, ChromeMessageResponse } from "./types.js";

type RefreshFn = () => void;

export async function handleSync(state: FavoritesState, refresh: RefreshFn): Promise<void> {
  try {
    // 获取用户ID
    const settingsResponse = await chrome.runtime.sendMessage({
      type: 'get_value',
      payload: { key: 'settings' }
    }) as unknown as ChromeMessageResponse<{ userId: string }>;

    const settings = settingsResponse?.data;
    if (!settings?.userId) {
      throw new Error('请先登录B站并获取用户ID');
    }

    // 同步收藏视频
    const syncResponse = await chrome.runtime.sendMessage({
      type: 'sync_favorite_videos',
      payload: { 
        uid: settings.userId
      }
    }) as unknown as ChromeMessageResponse<{ count: number }>;

    if (syncResponse?.success) {
      console.log(`[Favorites] Synced ${syncResponse.data?.count || 0} videos`);
      await refresh();
    } else {
      throw new Error(syncResponse?.error || '同步收藏视频失败');
    }
  } catch (error) {
    console.error('[Favorites] Error syncing favorite videos:', error);
    throw error;
  }
}

export function handleStopSync(state: FavoritesState): void {
  state.shouldStopSync = true;
  console.log('[Favorites] Stop sync requested');

  // 通知后台服务停止同步
  chrome.runtime.sendMessage({
    type: 'set_should_stop_sync',
    payload: { shouldStop: true }
  });
}

export function showStopSyncButton(show: boolean): void {
  const stopSyncBtn = document.getElementById('stopSyncBtn');
  if (stopSyncBtn) {
    stopSyncBtn.style.display = show ? 'inline-block' : 'none';
    (stopSyncBtn as HTMLButtonElement).disabled = !show;
  }
}

export function bindPageActions(
  state: FavoritesState,
  refresh: RefreshFn,
  setLoading: (loading: boolean) => void,
  showError: (message: string) => void
): void {
  const syncBtn = document.getElementById('syncBtn');
  const stopSyncBtn = document.getElementById('stopSyncBtn');

  syncBtn?.addEventListener('click', async () => {
    try {
      setLoading(true);
      state.shouldStopSync = false;
      showStopSyncButton(true);
      await handleSync(state, refresh);
    } catch (error) {
      showError(error instanceof Error ? error.message : '同步收藏视频失败');
    } finally {
      setLoading(false);
      showStopSyncButton(false);
    }
  });

  stopSyncBtn?.addEventListener('click', () => handleStopSync(state));
}
