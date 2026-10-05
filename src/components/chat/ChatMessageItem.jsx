import { memo } from 'react'
import { UserBubble, AiBubble, ChartBubble } from './ChatBubble'
import CardCarousel from './CardCarousel'
import ActionSuccessCard from './ActionSuccessCard'
import FinancialHealthWidget from './widgets/FinancialHealthWidget'
import TransactionSuccess from './TransactionSuccess'
import QuickChips from './QuickChips'
import DeleteConfirmCard from './DeleteConfirmCard'
import { translate } from '../../lib/i18n'

const ChatMessageItem = memo(function ChatMessageItem({
  msg,
  isLatestMessage = false,
  isLastAi = false,
  position = 'single',
  isLoading = false,
  locale = 'id',
  onSend,
  onStagePrompt,
  onMsgTouchStart,
  onMsgTouchMove,
  onMsgTouchEnd,
  onMsgContextMenu,
  onConfirmDelete,
  onCancelDelete,
  onUndoTransaction,
}) {
  return (
    <div className="flex flex-col gap-2 w-full min-w-0 max-w-full">
      {msg.role === 'user' && (
        <div
          className="flex flex-col items-end gap-1 w-full min-w-0 max-w-full cursor-pointer"
          onTouchStart={() => onMsgTouchStart?.(msg)}
          onTouchMove={onMsgTouchMove}
          onTouchEnd={onMsgTouchEnd}
          onContextMenu={(e) => onMsgContextMenu?.(e, msg)}
        >
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
          <div
            className="w-full min-w-0 max-w-full cursor-pointer"
            onTouchStart={() => onMsgTouchStart?.(msg)}
            onTouchMove={onMsgTouchMove}
            onTouchEnd={onMsgTouchEnd}
            onContextMenu={(e) => onMsgContextMenu?.(e, msg)}
          >
            <AiBubble
              content={msg.content || (msg.type === 'welcome' ? translate(locale, 'aiChat.welcome') : '')}
              timestamp={msg.timestamp}
              position={position}
              isNew={isLatestMessage}
              isStreaming={isLoading && isLatestMessage}
              expandableDetails={msg.expandableDetails || null}
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
                    onUndo={() => onUndoTransaction?.(msg.data, msg.id)}
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
