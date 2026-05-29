// jsdom の localStorage がワーカースレッドで不安定なため、Map ベースの軽量実装で上書き
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear() { this.store.clear() }
  getItem(key: string) { return this.store.get(key) ?? null }
  setItem(key: string, value: string) { this.store.set(key, value) }
  removeItem(key: string) { this.store.delete(key) }
  key(index: number) { return [...this.store.keys()][index] ?? null }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
})
