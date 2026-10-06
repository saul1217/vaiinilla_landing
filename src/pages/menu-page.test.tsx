import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../context/theme-context";
import { api } from "../lib/api";
import { QA_PHOTO_TACOS } from "../lib/qa-catalog-photos";
import { MenuPage } from "./menu-page";

const addLine = vi.fn();
const authState: { user: { email: string; displayName: string } | null } = {
  user: null,
};
const cartState: {
  cart: { slug: string; establishmentName: string; lines: unknown[] } | null;
} = { cart: { slug: "demo-a", establishmentName: "Demo A", lines: [] } };

vi.mock("../lib/api", () => ({
  api: {
    getEstablishment: vi.fn().mockResolvedValue({
      id: "1",
      nombre: "Cafetería Demo A",
      slug: "demo-a",
      identificador_cliente_etiqueta: "Matrícula",
      identificador_cliente_obligatorio: false,
    }),
    getPublicSpaces: vi.fn().mockResolvedValue([]),
    getGuestCatalog: vi.fn().mockResolvedValue({
      categorias: [{ id: 1, nombre: "Bebidas", orden: 1 }],
      productos: [
        {
          id: 10,
          categoria_id: 1,
          estacion_preparacion: "caja",
          nombre: "Chocolate frío",
          descripcion: "Bebida de cacao",
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 4,
          precio_mostrador: "40.00",
          precio_digital: "38.00",
          disponible: true,
          imagen_url: null,
          grupos_opcion: [],
        },
        {
          id: 11,
          categoria_id: 1,
          estacion_preparacion: "cocina",
          nombre: "Tacos dorados de res (5)",
          descripcion: null,
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 10,
          precio_mostrador: "150.00",
          precio_digital: "145.00",
          disponible: true,
          imagen_url: null,
          grupos_opcion: [],
        },
      ],
    }),
  },
}));

vi.mock("../context/auth-context", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: true,
    configured: true,
    signOut: vi.fn(),
  }),
}));

vi.mock("../context/cart-context", () => ({
  useCart: () => ({
    cart: cartState.cart,
    addLine,
    updateQuantity: vi.fn(),
    removeLine: vi.fn(),
    reset: vi.fn(),
  }),
}));

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={["/e/demo-a"]}>
      <ThemeProvider>
        <Routes>
          <Route path="/e/:slug" element={<MenuPage />} />
          <Route path="/e/:slug/carrito" element={<p>Carrito</p>} />
          <Route path="/cuenta" element={<p>Cuenta login</p>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("MenuPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    authState.user = null;
    cartState.cart = { slug: "demo-a", establishmentName: "Demo A", lines: [] };
    addLine.mockReset();
  });

  it("sin sesión agrega directo: cualquiera puede pedir sin cuenta", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      await screen.findByRole("button", { name: /chocolate frío/i }),
    );
    await user.click(screen.getByRole("button", { name: /agregar/i }));
    expect(addLine).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("link", { name: /crea tu cuenta/i }),
    ).not.toBeInTheDocument();
  });

  it("muestra las piezas aparte y nunca el (N) crudo", async () => {
    renderMenu();
    const card = await screen.findByRole("button", { name: /tacos dorados de res/i });
    expect(card).toHaveTextContent("$145 · 5 pzs");
    expect(card).not.toHaveTextContent("(5)");
  });

  it("búsqueda sin resultados dice qué no encontró y deja limpiarla", async () => {
    const user = userEvent.setup();
    renderMenu();
    await screen.findByRole("button", { name: /chocolate frío/i });
    await user.type(screen.getByLabelText("Buscar en el menú"), "pizza");
    expect(screen.getByRole("status")).toHaveTextContent("No encontramos “pizza” en el menú");
    await user.click(screen.getByRole("button", { name: /limpiar búsqueda/i }));
    expect(screen.getByRole("button", { name: /chocolate frío/i })).toBeInTheDocument();
  });

  it("con carrito de otra tienda confirma antes de vaciarlo", async () => {
    cartState.cart = {
      slug: "otra",
      establishmentName: "Otra",
      lines: [
        {
          productId: 1,
          quantity: 2,
          optionIds: [],
          productName: "Taco",
          unitPreview: "20.00",
          imageUrl: null,
        },
      ],
    };
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      await screen.findByRole("button", { name: /chocolate frío/i }),
    );
    await user.click(screen.getByRole("button", { name: /agregar/i }));
    // No vacía sin preguntar.
    expect(addLine).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", { name: /cambiar de tienda/i }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /vaciar y agregar aquí/i }),
    );
    expect(addLine).toHaveBeenCalledTimes(1);
  });

  it("donde se pide con matrícula, sin sesión pide crear cuenta", async () => {
    vi.mocked(api).getEstablishment.mockResolvedValueOnce({
      id: "1",
      nombre: "Escuela",
      slug: "demo-a",
      identificador_cliente_etiqueta: "Matrícula",
      identificador_cliente_obligatorio: true,
    });
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      await screen.findByRole("button", { name: /chocolate frío/i }),
    );
    expect(
      screen.queryByRole("button", { name: /agregar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /crea tu cuenta para pedir aquí/i }),
    ).toHaveAttribute("href", "/cuenta?next=/e/demo-a");
  });

  it("con foto de catálogo abre el rail y conserva un fallback hasta que cargue", async () => {
    vi.mocked(api).getGuestCatalog.mockResolvedValueOnce({
      categorias: [{ id: 1, nombre: "Platos", orden: 1 }],
      productos: [
        {
          id: 22,
          categoria_id: 1,
          estacion_preparacion: "cocina",
          nombre: "Tacos de Cochinita Pibil",
          descripcion: null,
          ingredientes: null,
          alergenos: null,
          tiempo_estimado_min: 8,
          precio_mostrador: "99.00",
          precio_digital: "99.00",
          disponible: true,
          imagen_url: QA_PHOTO_TACOS,
          grupos_opcion: [],
        },
      ],
    });
    const user = userEvent.setup();
    renderMenu();
    await user.click(
      await screen.findByRole("button", { name: /tacos de cochinita/i }),
    );
    const photo = document.querySelector(".alumno-psheet__photo");
    expect(photo).toHaveAttribute("src", QA_PHOTO_TACOS);
    expect(photo).not.toHaveClass("is-ready");
    expect(document.querySelector(".alumno-psheet__vaini")).toHaveAttribute(
      "src",
      "/vaini/cutout-frente.png",
    );
    fireEvent.load(photo!);
    expect(photo).toHaveClass("is-ready");
    expect(document.querySelector(".alumno-psheet__vaini")).toBeNull();
  });

  it("ofrece Rentar cancha solo si hay una cancha con precio por hora", async () => {
    vi.mocked(api).getPublicSpaces.mockResolvedValueOnce([
      { espacio: { tipo: "mesa" }, precio_hora: null },
      { espacio: { tipo: "cancha" }, precio_hora: "300.00" },
    ]);
    renderMenu();
    const link = await screen.findByRole("link", { name: /rentar una cancha/i });
    expect(link).toHaveAttribute("href", "/e/demo-a/canchas");
  });

  it("no ofrece Rentar cancha si las canchas no tienen precio o no hay canchas", async () => {
    vi.mocked(api).getPublicSpaces.mockResolvedValueOnce([
      { espacio: { tipo: "cancha" }, precio_hora: null },
      { espacio: { tipo: "mesa" }, precio_hora: "10.00" },
    ]);
    renderMenu();
    await screen.findByText(/chocolate/i);
    expect(screen.queryByRole("link", { name: /rentar una cancha/i })).not.toBeInTheDocument();
  });
});
