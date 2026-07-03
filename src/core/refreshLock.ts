/** 全局刷新锁：防止主刷新与设置内测试并发执行。 */

let locked = false;

export function isRefreshLocked(): boolean {
  return locked;
}

export function setRefreshLock(value: boolean): void {
  locked = value;
}
