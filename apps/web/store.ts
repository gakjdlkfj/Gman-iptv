import { create } from "zustand";

type PlayerState = {
  currentChannelId?: string;
  currentTitle?: string;
  lastError?: string;
  lowLatency: boolean;
  aspect: "contain" | "cover";
  setChannel: (id: string, title: string) => void;
  setError: (e?: string) => void;
  toggleLowLatency: () => void;
  toggleAspect: () => void;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  lowLatency: true,
  aspect: "contain",
  setChannel: (id, title) => set({ currentChannelId: id, currentTitle: title }),
  setError: (e) => set({ lastError: e }),
  toggleLowLatency: () => set({ lowLatency: !get().lowLatency }),
  toggleAspect: () => set({ aspect: get().aspect === "contain" ? "cover" : "contain" })
}));
