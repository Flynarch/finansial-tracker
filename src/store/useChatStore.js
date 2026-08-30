import { create } from 'zustand'

const useChatStore = create((set) => ({
  isOpen: false,
  isQuickLogOpen: false,
  messages: [],
  initialInput: '',
  backgroundTexture: typeof window !== 'undefined' ? (localStorage.getItem('ft_chat_bg_texture') || 'paper') : 'paper',
  
  // Background texture action
  setBackgroundTexture: (texture) => {
    if (typeof window !== 'undefined') localStorage.setItem('ft_chat_bg_texture', texture)
    set({ backgroundTexture: texture })
  },

  // Full Chat actions
  setIsOpen: (isOpen) => set({ isOpen }),
  closeChat: () => set({ isOpen: false }),
  setMessages: (updater) => set((state) => ({ 
    messages: typeof updater === 'function' ? updater(state.messages) : updater 
  })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setInitialInput: (input) => set({ initialInput: input }),
  openWithPrompt: (prompt) => set({
    isOpen: true,
    isQuickLogOpen: false,
    initialInput: prompt || ''
  }),

  // Quick Log actions
  autoScan: false,
  setIsQuickLogOpen: (isQuickLogOpen) => set({ isQuickLogOpen }),
  openQuickLog: (options = {}) => set({
    isQuickLogOpen: true,
    isOpen: false,
    autoScan: Boolean(options?.autoScan),
  }),
  clearAutoScan: () => set({ autoScan: false }),
  closeQuickLog: () => set({ isQuickLogOpen: false, autoScan: false }),
  switchToFullChat: (prompt) => set({
    isQuickLogOpen: false,
    isOpen: true,
    initialInput: prompt || '',
    autoScan: false,
  }),
}))

export default useChatStore
