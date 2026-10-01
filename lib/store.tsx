"use client";
import type { Product } from "@/lib/types";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CURRENCY_STORAGE_KEY, DEFAULT_CURRENCY, isCurrency, type Currency } from "@/lib/format";
export interface CartLine { productId: string; size: string; color: string; qty: number }
interface Ctx { open: boolean; setOpen: (v: boolean) => void; products: Product[]; cart: CartLine[]; wish: string[]; count: number; add: (l: CartLine) => void; setQty: (i: number, q: number) => void; remove: (i: number) => void; toggleWish: (id: string) => void; clear: () => void; currency: Currency; setCurrency: (c: Currency) => void }
const StoreCtx = createContext<Ctx | null>(null);
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
export function StoreProvider({ children, products }: { children: React.ReactNode; products: Product[] }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wish, setWish] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [synced, setSynced] = useState(false);
  // Always starts as the default so server and first client render match; the saved choice is restored after mount.
  const [currency, setCurrencyState] = useState<Currency>(DEFAULT_CURRENCY);
  useEffect(() => {
    try { const v = localStorage.getItem(CURRENCY_STORAGE_KEY); if (isCurrency(v)) setCurrencyState(v); } catch {}
    const sync = (e: StorageEvent) => { if (e.key === CURRENCY_STORAGE_KEY && isCurrency(e.newValue)) setCurrencyState(e.newValue); };
    addEventListener("storage", sync); return () => removeEventListener("storage", sync);
  }, []);
  const setCurrency = useCallback((c: Currency) => {
    if (!isCurrency(c)) return;
    setCurrencyState(c);
    try { localStorage.setItem(CURRENCY_STORAGE_KEY, c); } catch {}
  }, []);
  useEffect(() => { setCart(read("eu_cart", [])); setWish(read("eu_wish", [])); setReady(true);
    fetch("/api/wishlist").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.slugs) { setWish((w) => [...new Set([...w, ...j.slugs])]); setSynced(true); } }).catch(() => {}); }, []);
  useEffect(() => { if (!synced) return; const t = setTimeout(() => { fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs: wish }) }).catch(() => {}); }, 500); return () => clearTimeout(t); }, [wish, synced]);
  useEffect(() => { if (!ready) return; try { localStorage.setItem("eu_cart", JSON.stringify(cart)); localStorage.setItem("eu_wish", JSON.stringify(wish)); } catch {} }, [cart, wish, ready]);
  const add = (l: CartLine) => { addRaw(l); setOpen(true); };
  const addRaw = (l: CartLine) => setCart((c) => { const i = c.findIndex((x) => x.productId === l.productId && x.size === l.size && x.color === l.color); if (i < 0) return [...c, l]; return c.map((x, j) => (j === i ? { ...x, qty: Math.min(10, x.qty + l.qty) } : x)); });
  const setQty = (i: number, q: number) => setCart((c) => c.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Math.min(10, q)) } : x)));
  const remove = (i: number) => setCart((c) => c.filter((_, j) => j !== i));
  const clear = () => setCart([]);
  const toggleWish = (id: string) => setWish((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  return (
    <StoreCtx.Provider
      value={{
        open,
        setOpen,
        products,
        cart,
        wish,
        count: cart.reduce((n, l) => n + l.qty, 0),
        add,
        setQty,
        remove,
        toggleWish,
        clear,
        currency,
        setCurrency,
      }}
    >
      {children}
    </StoreCtx.Provider>
  );
}
export const useStore = () => { const c = useContext(StoreCtx); if (!c) throw new Error("useStore outside StoreProvider"); return c; };
