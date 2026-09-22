import WelcomeHero from './WelcomeHero'
import { ReasoningIndicator } from './ChatBubble'
import ChatMessageItem from './ChatMessageItem'

export default function ChatMessageList({
  messages = [],
  isLoading = false,
  locale = 'id',
  defaultCurrency = 'IDR',
  todayExpense = 0,
  chatScrollContainerRef,
  messagesEndRef,
  onScroll,
  onSend,
  onMsgTouchStart,
  onMsgTouchEnd,
  onMsgContextMenu,
  onConfirmDelete,
  onCancelDelete,
  onUndoTransaction,
}) {
  const visibleMessages = messages.filter((m) => m.type !== 'hidden')
  const isOnlyWelcome = visibleMessages.length <= 1 && (visibleMessages.length === 0 || visibleMessages[0]?.type === 'welcome')

  const getMessagePosition = (all, i) => {
    const curr = all[i]
    const prev = all[i - 1]
    const next = all[i + 1]
    const isPrevSame = prev && prev.role === curr.role
    const isNextSame = next && next.role === curr.role
    if (!isPrevSame && !isNextSame) return 'single'
    if (!isPrevSame && isNextSame) return 'first'
    if (isPrevSame && isNextSame) return 'middle'
    if (isPrevSame && !isNextSame) return 'last'
    return 'single'
  }

  return (
    <main
      ref={chatScrollContainerRef}
      onScroll={onScroll}
      className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3.5 ft-hide-scrollbar"
    >
      {isOnlyWelcome && !isLoading ? (
        <WelcomeHero
          onSelectPrompt={onSend}
          todayExpense={todayExpense}
          todayCurrency={defaultCurrency}
        />
      ) : (
        visibleMessages.map((msg, index) => {
          const isLastAi = msg.role === 'ai' && msg.id === visibleMessages[visibleMessages.length - 1].id
          const isLatestMessage = index === visibleMessages.length - 1
          const position = getMessagePosition(visibleMessages, index)

          return (
            <ChatMessageItem
              key={msg.id || index}
              msg={msg}
              isLatestMessage={isLatestMessage}
              isLastAi={isLastAi}
              position={position}
              isLoading={isLoading}
              locale={locale}
              onSend={onSend}
              onMsgTouchStart={onMsgTouchStart}
              onMsgTouchEnd={onMsgTouchEnd}
              onMsgContextMenu={onMsgContextMenu}
              onConfirmDelete={onConfirmDelete}
              onCancelDelete={onCancelDelete}
              onUndoTransaction={onUndoTransaction}
            />
          )
        })
      )}

      {isLoading && !messages.some((m) => m.id === (messages[messages.length - 1]?.id) && m.role === 'ai' && m.content) && (
        <ReasoningIndicator />
      )}

      <div ref={messagesEndRef} className="h-2" />
    </main>
  )
}
