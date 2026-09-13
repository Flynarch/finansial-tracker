import { db } from './db'
import {
  removeExpenseParentCategory,
  removeExpenseSubcategory,
} from './expenseCategories'
import {
  removeIncomeParentCategory,
  removeIncomeSubcategory,
} from './incomeCategories'

/**
 * Cascading deletion for a subcategory:
 * 1. Removes the subcategory from the category registry.
 * 2. Remaps matching transactions in Dexie to parent/lainnya.
 * 3. Remaps matching split items in split transactions to parent/lainnya.
 * 4. Remaps matching budgets in Dexie to parent/lainnya.
 *
 * @param {string} parentId
 * @param {string} childId
 * @param {'expense'|'income'} [type='expense']
 */
export async function cascadeDeleteSubcategory(parentId, childId, type = 'expense') {
  if (!parentId || !childId) return

  if (type === 'expense') {
    removeExpenseSubcategory(parentId, childId)
  } else {
    removeIncomeSubcategory(parentId, childId)
  }

  const targetPath = `${parentId}/${childId}`
  const fallbackPath =
    childId === 'lainnya'
      ? (type === 'expense' ? 'lainnya_kategori/umum' : 'lainnya/umum')
      : `${parentId}/lainnya`

  try {
    await db.transaction('rw', [db.transactions, db.budgets, db.recurringTransactions], async () => {
      // 1. Remap direct transactions
      await db.transactions.where('category').equals(targetPath).modify({ category: fallbackPath })

      // 2. Remap split transaction items
      const splitTxs = await db.transactions
        .filter(
          (tx) =>
            tx.isSplit &&
            Array.isArray(tx.splitItems) &&
            tx.splitItems.some((item) => item.category === targetPath)
        )
        .toArray()

      for (const tx of splitTxs) {
        const updatedItems = tx.splitItems.map((item) =>
          item.category === targetPath ? { ...item, category: fallbackPath } : item
        )
        await db.transactions.update(tx.id, { splitItems: updatedItems })
      }

      // 3. Remap or merge budgets to avoid duplicate category budgets in the same month
      const budgetsToRemap = await db.budgets.where('category').equals(targetPath).toArray()
      for (const b of budgetsToRemap) {
        const existingFallback = await db.budgets
          .where('category')
          .equals(fallbackPath)
          .filter((eb) => eb.month === b.month)
          .first()
        if (existingFallback) {
          await db.budgets.update(existingFallback.id, {
            limit: (existingFallback.limit || 0) + (b.limit || 0),
          })
          await db.budgets.delete(b.id)
        } else {
          await db.budgets.update(b.id, { category: fallbackPath })
        }
      }

      // 4. Remap matching recurring transactions
      await db.recurringTransactions.where('category').equals(targetPath).modify({ category: fallbackPath })
    })
  } catch (err) {
    console.error('Cascade delete subcategory failed:', err)
  }
}

/**
 * Cascading deletion for a parent category:
 * 1. Removes the parent category from the category registry.
 * 2. Remaps matching transactions (and split items) in Dexie to fallback 'lainnya_kategori/umum' or 'lainnya/umum'.
 * 3. Purges linked budgets in Dexie matching the parent.
 * 4. Remaps matching recurring transactions in Dexie to fallback.
 *
 * @param {string} parentId
 * @param {'expense'|'income'} [type='expense']
 */
export async function cascadeDeleteParentCategory(parentId, type = 'expense') {
  if (!parentId) return

  if (type === 'expense') {
    removeExpenseParentCategory(parentId)
  } else {
    removeIncomeParentCategory(parentId)
  }

  const fallbackPath = type === 'expense' ? 'lainnya_kategori/umum' : 'lainnya/umum'

  try {
    await db.transaction('rw', [db.transactions, db.budgets, db.recurringTransactions], async () => {
      const txsToUpdate = await db.transactions
        .filter((tx) => {
          const cat = tx.category
          const matchesParent = cat === parentId || (typeof cat === 'string' && cat.startsWith(`${parentId}/`))
          const hasMatchingSplit =
            tx.isSplit &&
            Array.isArray(tx.splitItems) &&
            tx.splitItems.some(
              (item) =>
                item.category === parentId ||
                (typeof item.category === 'string' && item.category.startsWith(`${parentId}/`))
            )
          return matchesParent || hasMatchingSplit
        })
        .toArray()

      for (const tx of txsToUpdate) {
        const cat = tx.category
        const matchesParent = cat === parentId || (typeof cat === 'string' && cat.startsWith(`${parentId}/`))
        const updateData = {}
        if (matchesParent) {
          updateData.category = fallbackPath
        }
        if (tx.isSplit && Array.isArray(tx.splitItems)) {
          updateData.splitItems = tx.splitItems.map((item) => {
            if (
              item.category === parentId ||
              (typeof item.category === 'string' && item.category.startsWith(`${parentId}/`))
            ) {
              return { ...item, category: fallbackPath }
            }
            return item
          })
        }
        await db.transactions.update(tx.id, updateData)
      }

      const budgetsToDelete = await db.budgets
        .filter(
          (b) =>
            b.category === parentId ||
            (typeof b.category === 'string' && b.category.startsWith(`${parentId}/`))
        )
        .toArray()

      if (budgetsToDelete.length > 0) {
        await db.budgets.bulkDelete(budgetsToDelete.map((b) => b.id))
      }

      // Remap matching recurring transactions
      const recurringToUpdate = await db.recurringTransactions
        .filter((rt) => {
          const cat = rt.category
          return cat === parentId || (typeof cat === 'string' && cat.startsWith(`${parentId}/`))
        })
        .toArray()

      for (const rt of recurringToUpdate) {
        await db.recurringTransactions.update(rt.id, { category: fallbackPath })
      }
    })
  } catch (err) {
    console.error('Cascade delete parent category failed:', err)
  }
}
