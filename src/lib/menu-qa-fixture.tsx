import { createContext, useContext, type ReactNode } from 'react';
import type { CatalogResponse, OrderDetail, PublicEstablishment } from '../types/api';

export type MenuQaFixture = { user: { displayName: string; email: string }; place: PublicEstablishment; catalog: CatalogResponse; order: OrderDetail };
const MenuQaFixtureContext = createContext<MenuQaFixture | null>(null);
export function MenuQaFixtureProvider({ fixture, children }: { fixture: MenuQaFixture; children: ReactNode }) {
  return <MenuQaFixtureContext.Provider value={fixture}>{children}</MenuQaFixtureContext.Provider>;
}
// The hook is shared with MenuPage; keep context access in this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useMenuQaFixture() { return useContext(MenuQaFixtureContext); }
