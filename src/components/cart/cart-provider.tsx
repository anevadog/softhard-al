"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  CART_STORAGE_KEY,
  actualizarCantidad as actualizarCantidadEnCarrito,
  agregarProducto,
  contarUnidades,
  eliminarProducto,
  parsearCarrito,
  serializarCarrito,
  type CartItem,
} from "@/lib/cart";

type CartContextValue = {
  items: CartItem[];
  totalUnidades: number;
  hidratado: boolean;
  agregar: (productId: string, stock: number) => void;
  actualizarCantidad: (
    productId: string,
    cantidad: number,
    stock: number,
  ) => void;
  eliminar: (productId: string) => void;
  vaciar: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function leerCarritoGuardado(): CartItem[] {
  try {
    return parsearCarrito(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setItems(leerCarritoGuardado());
    setHidratado(true);

    function alCambiarStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY || event.key === null) {
        setItems(leerCarritoGuardado());
      }
    }

    window.addEventListener("storage", alCambiarStorage);

    return () => window.removeEventListener("storage", alCambiarStorage);
  }, []);

  useEffect(() => {
    if (!hidratado) {
      return;
    }

    try {
      window.localStorage.setItem(
        CART_STORAGE_KEY,
        serializarCarrito(items),
      );
    } catch {
      // Si el navegador bloquea LocalStorage, el carrito sigue en memoria.
    }
  }, [items, hidratado]);

  const agregar = useCallback((productId: string, stock: number) => {
    setItems((actuales) => agregarProducto(actuales, productId, stock));
  }, []);

  const actualizarCantidad = useCallback(
    (productId: string, cantidad: number, stock: number) => {
      setItems((actuales) =>
        actualizarCantidadEnCarrito(actuales, productId, cantidad, stock),
      );
    },
    [],
  );

  const eliminar = useCallback((productId: string) => {
    setItems((actuales) => eliminarProducto(actuales, productId));
  }, []);

  const vaciar = useCallback(() => {
    // Se borra de forma síncrona para no depender del efecto de persistencia:
    // al navegar a /app el provider puede desmontarse antes de ejecutarlo.
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // Si el navegador bloquea LocalStorage, al menos se vacía la memoria.
    }

    setItems([]);
  }, []);

  const totalUnidades = useMemo(() => contarUnidades(items), [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalUnidades,
      hidratado,
      agregar,
      actualizarCantidad,
      eliminar,
      vaciar,
    }),
    [
      items,
      totalUnidades,
      hidratado,
      agregar,
      actualizarCantidad,
      eliminar,
      vaciar,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const contexto = useContext(CartContext);

  if (!contexto) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }

  return contexto;
}
