// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatDeletion } from '../src/components/chat/hooks/useChatDeletion'
import { deleteTransaction, updateTransaction } from '../src/services/transactionService'

vi.mock('../src/services/transactionService', () => ({
  deleteTransaction: vi.fn().mockResolvedValue(1),
  updateTransaction: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/lib/haptics', () => ({
  triggerHaptic: vi.fn(),
}))

describe('AI Chat Deletion Hook - Atomic Rollback & Batch Delete', () => {
  let setMessagesMock

  beforeEach(() => {
    vi.clearAllMocks()
    setMessagesMock = vi.fn()
  })

  it('performs atomic rollback on undo update without deleting transactions from database', async () => {
    const { result } = renderHook(() =>
      useChatDeletion({ setMessages: setMessagesMock, locale: 'id' })
    )

    const updatedData = [
      { id: 201, amount: 50000, category: 'makanan/jajanan' },
      { id: 202, amount: 60000, category: 'transportasi/taksi' },
    ]

    const previousSnapshots = [
      { id: 201, amount: 25000, category: 'makanan/kopi' },
      { id: 202, amount: 30000, category: 'transportasi/bensin' },
    ]

    await act(async () => {
      await result.current.handleUndoTransaction(
        updatedData,
        'msg-1',
        true, // isUpdate
        previousSnapshots
      )
    })

    // Must NOT call deleteTransaction
    expect(deleteTransaction).not.toHaveBeenCalled()

    // Must call updateTransaction with previous fields to restore them
    expect(updateTransaction).toHaveBeenCalledTimes(2)
    expect(updateTransaction).toHaveBeenCalledWith(201, { amount: 25000, category: 'makanan/kopi' })
    expect(updateTransaction).toHaveBeenCalledWith(202, { amount: 30000, category: 'transportasi/bensin' })

    // Message is removed from chat state
    expect(setMessagesMock).toHaveBeenCalled()
  })

  it('deletes transactions when undoing a newly created transaction', async () => {
    const { result } = renderHook(() =>
      useChatDeletion({ setMessages: setMessagesMock, locale: 'id' })
    )

    const createdData = [
      { id: 301, amount: 10000 },
      { id: 302, amount: 20000 },
    ]

    await act(async () => {
      await result.current.handleUndoTransaction(
        createdData,
        'msg-2',
        false // isUpdate = false
      )
    })

    expect(deleteTransaction).toHaveBeenCalledTimes(2)
    expect(deleteTransaction).toHaveBeenCalledWith(301)
    expect(deleteTransaction).toHaveBeenCalledWith(302)
    expect(updateTransaction).not.toHaveBeenCalled()
  })

  it('executes batch deletion when handleConfirmDelete receives an array of transaction IDs', async () => {
    const { result } = renderHook(() =>
      useChatDeletion({ setMessages: setMessagesMock, locale: 'id' })
    )

    await act(async () => {
      await result.current.handleConfirmDelete([401, 402, 403], 'msg-3', 'transaction')
    })

    expect(deleteTransaction).toHaveBeenCalledTimes(3)
    expect(deleteTransaction).toHaveBeenCalledWith(401)
    expect(deleteTransaction).toHaveBeenCalledWith(402)
    expect(deleteTransaction).toHaveBeenCalledWith(403)
    expect(setMessagesMock).toHaveBeenCalled()
  })
})
