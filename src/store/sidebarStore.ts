/* ================================================================
   Sidebar Store — Zustand
   Manages sidebar collapse, mobile open, and active menu state
   ================================================================ */
import { create } from "zustand";

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  activeMenu: string | null;
  expandedMenus: string[];

  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleMobile: () => void;
  setMobileOpen: (open: boolean) => void;
  setActiveMenu: (menu: string) => void;
  toggleExpandedMenu: (menu: string) => void;
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  isCollapsed: false,
  isMobileOpen: false,
  activeMenu: null,
  expandedMenus: [],

  toggleCollapse: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
  setCollapsed: (isCollapsed) => set({ isCollapsed }),
  toggleMobile: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
  setMobileOpen: (isMobileOpen) => set({ isMobileOpen }),
  setActiveMenu: (activeMenu) => set({ activeMenu }),

  toggleExpandedMenu: (menu) => {
    const { expandedMenus } = get();
    if (expandedMenus.includes(menu)) {
      set({ expandedMenus: expandedMenus.filter((m) => m !== menu) });
    } else {
      set({ expandedMenus: [...expandedMenus, menu] });
    }
  },
}));
