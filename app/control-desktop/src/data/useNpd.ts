import { useSyncExternalStore } from "react";
import { getNpdVersion, npd, type NpdApi } from "./npd";

/**
 * 订阅 NPD 数据变化并返回数据层实例。
 * 读操作每次渲染时实时调用 getter（getTodayPlan 等每次返回新对象），
 * 因此 useSyncExternalStore 只订阅单调递增的版本号，不做选择器缓存。
 */
export function useNpd(): NpdApi {
  useSyncExternalStore(
    (onStoreChange) => npd.onChange(onStoreChange),
    getNpdVersion,
  );
  return npd;
}
