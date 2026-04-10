import { createContext, useContext } from 'react'

export const AgentChatContext = createContext({
  conversations: [],
  activeConversationId: null,
  messages: [],
  loading: false,
  panelOpen: false,
  openChat: () => {},
  closeChat: () => {},
  openConversation: () => {},
  createConversation: () => {},
  createConversationWithContext: () => {},
  sendMessage: () => {},
  deleteConversation: () => {},
  refreshConversations: () => {},
})

export function useAgentChat() {
  return useContext(AgentChatContext)
}
