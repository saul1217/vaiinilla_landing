import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTableDeviceTokens,
  pruneTableDeviceTokens,
  saveTableDeviceToken,
  tableDeviceToken,
} from "./table-device-token";

const KEY = "vaiinilla.mesa.dispositivo";

describe("table-device-token", () => {
  beforeEach(() => localStorage.clear());

  it("guarda y lee el token por participante", () => {
    saveTableDeviceToken("p1", "tok-1", "s1");
    saveTableDeviceToken("p2", "tok-2", "s1");
    expect(tableDeviceToken("p1")).toBe("tok-1");
    expect(tableDeviceToken("p2")).toBe("tok-2");
    expect(tableDeviceToken("p3")).toBeNull();
  });

  it("rota: el último token gana", () => {
    saveTableDeviceToken("p1", "viejo", "s1");
    saveTableDeviceToken("p1", "nuevo", "s1");
    expect(tableDeviceToken("p1")).toBe("nuevo");
  });

  it("al salir o cerrar la sesión se borra todo", () => {
    saveTableDeviceToken("p1", "tok-1", "s1");
    clearTableDeviceTokens();
    expect(tableDeviceToken("p1")).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("con otra sesión vigente borra los tokens de sesiones cerradas", () => {
    saveTableDeviceToken("viejo", "tok-v", "s1");
    saveTableDeviceToken("nuevo", "tok-n", "s2");
    pruneTableDeviceTokens("s2");
    expect(tableDeviceToken("viejo")).toBeNull();
    expect(tableDeviceToken("nuevo")).toBe("tok-n");
  });

  it("tolera almacenamiento corrupto", () => {
    localStorage.setItem(KEY, "{no json");
    expect(tableDeviceToken("p1")).toBeNull();
  });
});
