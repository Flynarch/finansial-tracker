import { create } from 'zustand'

const useChatStore = create((set) => ({
  isOpen: false,
  isQuickLogOpen: false,
  messages: [],
  initialInput: '',
  
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
  setIsQuickLogOpen: (isQuickLogOpen) => set({ isQuickLogOpen }),
  openQuickLog: () => set({ isQuickLogOpen: true, isOpen: false }),
  closeQuickLog: () => set({ isQuickLogOpen: false }),
  switchToFullChat: (prompt) => set({
    isQuickLogOpen: false,
    isOpen: true,
    initialInput: prompt || ''
  }),
}))

export default useChatStore
