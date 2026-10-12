import { memo, useState, useRef } from 'react'
import { Reply } from 'lucide-react'
import { UserBubble, AiBubble, ChartBubble } from './ChatBubble'
import CardCarousel from './CardCarousel'
import ActionSuccessCard from './ActionSuccessCard'
import FinancialHealthWidget from './widgets/FinancialHealthWidget'
import TransactionSuccess from './TransactionSuccess'
import QuickChips from './QuickChips'
import DeleteConfirmCard from './DeleteConfirmCard'
import { translate } from '../../lib/i18n'
import { triggerHaptic } from '../../lib/haptics'

const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  isLatestMessage = false,
  isLastAi = false,
  position = 'single',
  isLoading = false,
  locale = 'id',
  onSend,
  onRegenerate,
  onStagePrompt,
  onMsgTouchStart,
  onMsgTouchMove,
  onMsgTouchEnd,
  onMsgContextMenu,
  onConfirmDelete,
  onCancelDelete,
  onUndoTransaction,
  onEditItem,
  wallets = [],
}) {
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartRef = useRef({ x: 0, y: 0 })

  const handleTouchStart = (e) => {
    const t = e.touches?.[0]
    if (t) {
      touchStartRef.current = { x: t.clientX, y: t.clientY }
    }
    setIsSwiping(false)
    onMsgTouchStart?.(msg)
  }

  const handleTouchMove = (e) => {
    onMsgTouchMove?.()
    const t = e.touches?.[0]
    if (!t) return
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y

    if (Math.abs(dx) > Math.abs(dy) * 1.4 && dx > 6) {
      setIsSwiping(true)
      const clamped = Math.min(dx * 0.42, 60)
      setSwipeX(clamped)
    }
  }

  const handleTouchEnd = () => {
    onMsgTouchEnd?.()
    if (isSwiping && swipeX >= 36) {
      triggerHaptic('medium')
      if (msg.content) {
        onStagePrompt?.(msg.content)
      }
    }
    setSwipeX(0)
    setIsSwiping(false)
  }

  return (
    <div
      className="relative flex flex-col gap-1.5 w-full min-w-0 max-w-full touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => onMsgContextMenu?.(e, msg)}
      style={{
        transform: `translateX(${swipeX}px)`,
        transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {swipeX > 6 && (
        <div
          className="absolute -left-7 top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] pointer-events-none transition-opacity"
          style={{
            opacity: Math.min(swipeX / 36, 1),
            transform: `translateY(-50%) scale(${Math.min(0.7 + (swipeX / 70), 1)})`,
          }}
        >
          <Reply size={13} strokeWidth={2.4} />
        </div>
      )}

      {msg.role === 'user' && (
        <div className="flex flex-col items-end gap-1 w-full min-w-0 max-w-full cursor-pointer">
          {msg.image && (
            <img
              src={msg.image}
              alt={translate('common.upload', locale) || 'Upload'}
              className="max-w-[200px] rounded-2xl border border-[var(--border)] shadow-xs"
            />
          )}
          {msg.content && (
            <UserBubble
              content={msg.content}
              timestamp={msg.timestamp}
              status={isLoading && isLatestMessage ? 'sent' : 'confirmed'}
            />
          )}
        </div>
      )}

      {(msg.role === 'ai' || msg.role === 'assistant') && (
        <>
          <div className="w-full min-w-0 max-w-full cursor-pointer">
            <AiBubble
              content={msg.content || (msg.type === 'welcome' ? translate(locale, 'aiChat.welcome') : '')}
              timestamp={msg.timestamp}
              position={position}
              isNew={isLatestMessage}
              isStreaming={isLoading && isLatestMessage}
              expandableDetails={msg.expandableDetails || null}
              onRegenerate={onRegenerate}
              msgId={msg.id}
              embeddedWidget={
                msg.type === 'carousel' && Array.isArray(msg.items) ? (
                  <CardCarousel>
                    {msg.items.map((item, idx) => (
                      <ActionSuccessCard
                        key={idx}
                        type={item.type}
                        action={item.action}
                        title={item.title}
                        subtitle={item.subtitle}
                        data={item.data || item}
                        embedded={true}
                      />
                    ))}
                  </CardCarousel>
                ) : msg.type === 'financial_health' ? (
                  <FinancialHealthWidget
                    score={msg.score}
                    rating={msg.rating}
                    savingsRate={msg.metrics?.savingsRatio}
                    expenseVelocity={
                      msg.metrics?.monthlyIncome > 0
                        ? Math.round((msg.metrics?.monthlyExpense / msg.metrics?.monthlyIncome) * 100)
                        : null
                    }
                    debtRatio={msg.metrics?.dti}
                    budgetCompliance={
                      msg.metrics?.emergencyMonths != null
                        ? Math.min(100, Math.round((msg.metrics.emergencyMonths / 6) * 100))
                        : null
                    }
                    onAction={onStagePrompt || onSend}
                  />
                ) : msg.type === 'chart' && msg.data ? (
                  <ChartBubble data={msg.data} chartType={msg.chartType} embedded={true} />
                ) : msg.type === 'success' ? (
                  <TransactionSuccess
                    data={msg.data}
                    embedded={true}
                    timestamp={msg.timestamp}
                    msgId={msg.id}
                    isSaved={Boolean(msg.isSaved)}
                    isUpdate={Boolean(msg.isUpdate || msg.action === 'update')}
                    onUndo={() => onUndoTransaction?.(msg.data, msg.id, Boolean(msg.isUpdate || msg.action === 'update'), msg.previousData)}
                    onEditItem={onEditItem}
                    wallets={wallets}
                    contextMsg={msg.customMsg || translate(locale, 'aiChat.more')}
                  />
                ) : msg.type === 'action_success' && msg.data ? (
                  <ActionSuccessCard
                    type={msg.data.type}
                    action={msg.data.action}
                    title={msg.data.title}
                    subtitle={msg.data.subtitle}
                    data={msg.data.data || msg.data}
                    embedded={true}
                  />
                ) : msg.type === 'delete_confirm' && msg.data ? (
                  <DeleteConfirmCard
                    msgId={msg.id}
                    data={msg.data}
                    locale={locale}
                    onConfirm={onConfirmDelete}
                    onCancel={onCancelDelete}
                  />
                ) : null
              }
            />
          </div>
          {isLastAi && !isLoading && (
            <QuickChips
              chips={msg.type === 'welcome' ? null : msg.chips}
              onSelect={onStagePrompt || onSend}
            />
          )}
        </>
      )}
    </div>
  )
})

export default ChatMessageItem
