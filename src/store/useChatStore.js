import { create } from 'zustand'

const useChatStore = create((set) => ({
  isOpen: false,
  messages: [],
  setIsOpen: (isOpen) => set({ isOpen }),
  setMessages: (updater) => set((state) => ({ 
    messages: typeof updater === 'function' ? updater(state.messages) : updater 
  })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  initialInput: '',
  setInitialInput: (input) => set({ initialInput: input }),
  openWithPrompt: (prompt) => set({
    isOpen: true,
    initialInput: prompt
  })
}))

export default useChatStore
