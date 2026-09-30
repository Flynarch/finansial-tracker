import { format, subDays, differenceInCalendarDays, startOfWeek, isSameWeek, isBefore } from 'date-fns'

export function calculateHabitStats(habit, allLogs) {
  const logs = allLogs.filter(log => log.habitId === habit.id)
  const logDates = new Set(logs.map(log => log.date))
  
  const todayDate = new Date()
  const createdAt = habit.createdAt ? new Date(habit.createdAt) : todayDate
  const daysSinceCreation = Math.max(1, differenceInCalendarDays(todayDate, createdAt) + 1)
  
  let currentStreak
  let bestStreak = 0
  let totalScheduledPast = 0
  let totalCompletedPast = 0
  
  let currentWeekCompleted = 0
  let currentWeekTarget
  
  const trendData = [] // For the last 14 days
  
  // Calculate current week boundaries
  const weekStart = startOfWeek(todayDate, { weekStartsOn: 1 }) // Monday
  
  // First, calculate Weekly Progress (Progress Minggu Ini)
  if (habit.frequencyType === 'weekly') {
    currentWeekTarget = habit.frequencyValue || 3
  } else if (habit.frequencyType === 'specific_days') {
    currentWeekTarget = Array.isArray(habit.frequencyValue) ? habit.frequencyValue.length : 0
  } else {
    currentWeekTarget = 7 // Daily
  }
  
  // Count how many times it was completed this current week
  logs.forEach(log => {
    const d = new Date(log.date)
    if (isSameWeek(d, todayDate, { weekStartsOn: 1 })) {
      currentWeekCompleted++
    }
  })

  if (habit.frequencyType === 'weekly') {
    const target = currentWeekTarget
    
    // Simplification for weekly stats streak
    let currentWkCnt = 0
    let lastWkCnt = 0
    logs.forEach(log => {
      const d = new Date(log.date)
      if (isSameWeek(d, todayDate, { weekStartsOn: 1 })) currentWkCnt++
      if (isSameWeek(d, subDays(todayDate, 7), { weekStartsOn: 1 })) lastWkCnt++
    })
    
    currentStreak = currentWkCnt >= target ? 1 : 0
    if (lastWkCnt >= target) currentStreak += 1
    bestStreak = currentStreak
    
    // Completion Rate (Fair calculation)
    // How many FULL weeks have passed since createdAt?
    const createdWeekStart = startOfWeek(createdAt, { weekStartsOn: 1 })
    let pastWeeks = differenceInCalendarDays(weekStart, createdWeekStart) / 7
    if (pastWeeks < 0) pastWeeks = 0
    
    // Denominator = (Target * Full Past Weeks) + (Completions this week)
    // This gives instant reward for this week, without penalizing incomplete targets until the week ends.
    totalScheduledPast = (Math.floor(pastWeeks) * target) + currentWkCnt
    
    let pastCompletions = 0
    logs.forEach(log => {
      const d = new Date(log.date)
      if (isBefore(d, weekStart)) {
        pastCompletions++
      }
    })
    // Numerator = Past Completions + Completions this week
    totalCompletedPast = pastCompletions + currentWkCnt
    
    // Trend data (just days for weekly too for simplicity)
    for (let i = 13; i >= 0; i--) {
      const d = subDays(todayDate, i)
      const dateStr = format(d, 'yyyy-MM-dd')
      trendData.push({
        date: format(d, 'dd MMM'),
        completed: logDates.has(dateStr) ? 1 : 0
      })
    }
  } else {
    // Daily & Specific Days logic
    let tempStreak = 0
    
    // Scan backwards for current streak (Max 365 days)
    for (let i = 0; i < 365; i++) {
      const d = subDays(todayDate, i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayIdx = d.getDay()
      
      let isScheduled = false
      if (!habit.frequencyType || habit.frequencyType === 'daily') isScheduled = true
      else if (habit.frequencyType === 'specific_days' && Array.isArray(habit.frequencyValue) && habit.frequencyValue.includes(dayIdx)) {
        isScheduled = true
      }
      
      if (isScheduled) {
        if (logDates.has(dateStr)) {
          tempStreak++
        } else {
          // Streak breaks if not completed, UNLESS it's today (gives them a chance to complete it today)
          if (i !== 0) {
            break
          }
        }
      }
    }
    currentStreak = tempStreak
    
    // Scan forwards from createdAt for overall stats and best streak
    tempStreak = 0
    for (let i = daysSinceCreation - 1; i >= 0; i--) {
      const d = subDays(todayDate, i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayIdx = d.getDay()
      
      let isScheduled = false
      if (!habit.frequencyType || habit.frequencyType === 'daily') isScheduled = true
      else if (habit.frequencyType === 'specific_days' && Array.isArray(habit.frequencyValue) && habit.frequencyValue.includes(dayIdx)) {
        isScheduled = true
      }
      
      if (isScheduled) {
        const isCompleted = logDates.has(dateStr)
        const isPast = i > 0 // i > 0 means it's strictly before today
        
        // Fair Completion Rate Logic:
        // Only count it in scheduled denominator if it's a PAST day, OR if it's today and they already completed it.
        if (isPast || isCompleted) {
           totalScheduledPast++
           if (isCompleted) {
             totalCompletedPast++
           }
        }

        // Best streak calculation
        if (isCompleted) {
          tempStreak++
          if (tempStreak > bestStreak) bestStreak = tempStreak
        } else {
          tempStreak = 0
        }
      }
    }
    
    // Trend data for last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = subDays(todayDate, i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayIdx = d.getDay()
      
      let isScheduled = false
      if (!habit.frequencyType || habit.frequencyType === 'daily') isScheduled = true
      else if (habit.frequencyType === 'specific_days' && Array.isArray(habit.frequencyValue) && habit.frequencyValue.includes(dayIdx)) {
        isScheduled = true
      }
      
      if (isScheduled) {
        trendData.push({
          date: format(d, 'dd MMM'),
          completed: logDates.has(dateStr) ? 1 : 0
        })
      } else {
        trendData.push({
          date: format(d, 'dd MMM'),
          completed: 0 // or omit? keeping 0 for chart spacing
        })
      }
    }
  }
  
  const completionRate = totalScheduledPast > 0 ? Math.round((totalCompletedPast / totalScheduledPast) * 100) : (totalCompletedPast > 0 ? 100 : 0)
  
  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
    completionRate: Math.min(100, Math.max(0, completionRate)),
    currentWeekCompleted,
    currentWeekTarget,
    totalCompleted: logs.length,
    trendData
  }
}

export function calculateWeeklyTrend(habit, allLogs, weeksCount = 8) {
  if (!habit) return []
  const logs = allLogs.filter(log => log.habitId === habit.id)
  const logDates = new Set(logs.map(log => log.date))
  const todayDate = new Date()
  const todayStr = format(todayDate, 'yyyy-MM-dd')
  const createdAtStr = habit.createdAt ? (typeof habit.createdAt === 'string' ? habit.createdAt.slice(0, 10) : format(new Date(habit.createdAt), 'yyyy-MM-dd')) : todayStr
  
  const trend = []
  
  for (let w = weeksCount - 1; w >= 0; w--) {
    const weekStart = startOfWeek(subDays(todayDate, w * 7), { weekStartsOn: 1 })
    const isFuture = isBefore(todayDate, weekStart)
    if (isFuture) continue
    
    const isCurrentWeek = (w === 0)
    
    // Check if habit existed at all in this week
    const weekEndStr = format(subDays(weekStart, -6), 'yyyy-MM-dd')
    if (weekEndStr < createdAtStr) {
      trend.push({ week: format(weekStart, 'dd MMM'), rate: 0, rawCompleted: 0, rawTarget: 0 })
      continue
    }

    if (isCurrentWeek) {
      // Current week: target/denominator only from max(weekStart, createdAt) to todayDate
      let targetDaysCount = 0
      let completedDaysCount = 0
      
      for (let i = 0; i < 7; i++) {
        const d = subDays(weekStart, -i)
        const dateStr = format(d, 'yyyy-MM-dd')
        if (dateStr > todayStr) continue
        if (dateStr < createdAtStr) continue
        
        const dayIdx = d.getDay()
        let isScheduled = false
        if (!habit.frequencyType || habit.frequencyType === 'daily' || habit.frequencyType === 'weekly') {
          isScheduled = true
        } else if (habit.frequencyType === 'specific_days' && Array.isArray(habit.frequencyValue)) {
          isScheduled = habit.frequencyValue.includes(dayIdx)
        }
        
        if (isScheduled) {
          targetDaysCount++
          if (logDates.has(dateStr)) {
            completedDaysCount++
          }
        }
      }
      
      let target = targetDaysCount
      let completed = completedDaysCount
      if (habit.frequencyType === 'weekly') {
        target = Math.min(habit.frequencyValue || 3, targetDaysCount)
      }
      
      const rate = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0
      trend.push({ week: format(weekStart, 'dd MMM'), rate, rawCompleted: completed, rawTarget: target })
    } else {
      // Past week: full target (7 days or weekly target)
      let target = 7
      if (habit.frequencyType === 'weekly') {
        target = habit.frequencyValue || 3
      } else if (habit.frequencyType === 'specific_days') {
        target = Array.isArray(habit.frequencyValue) ? habit.frequencyValue.length : 0
      }
      
      let completed = 0
      for (let i = 0; i < 7; i++) {
        const d = subDays(weekStart, -i)
        const dateStr = format(d, 'yyyy-MM-dd')
        if (dateStr < createdAtStr) continue
        
        const dayIdx = d.getDay()
        let isScheduled = false
        if (!habit.frequencyType || habit.frequencyType === 'daily' || habit.frequencyType === 'weekly') {
          isScheduled = true
        } else if (habit.frequencyType === 'specific_days' && Array.isArray(habit.frequencyValue)) {
          isScheduled = habit.frequencyValue.includes(dayIdx)
        }
        
        if (isScheduled && logDates.has(dateStr)) {
          completed++
        }
      }
      
      const rate = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0
      trend.push({ week: format(weekStart, 'dd MMM'), rate, rawCompleted: completed, rawTarget: target })
    }
  }
  
  return trend
}

export function calculateGlobalWeeklyTrend(allHabits, allLogs, weeksCount = 8) {
  if (!allHabits || allHabits.length === 0) return []
  
  const habitsTrends = allHabits.map(habit => calculateWeeklyTrend(habit, allLogs, weeksCount))
  const globalTrend = []
  
  for (let w = 0; w < weeksCount; w++) {
    let sumRates = 0
    let validHabits = 0
    let weekLabel = ''
    
    habitsTrends.forEach(trendArray => {
      if (trendArray[w]) {
        weekLabel = trendArray[w].week
        if (trendArray[w].rawTarget > 0) {
           sumRates += trendArray[w].rate
           validHabits++
        }
      }
    })
    
    if (weekLabel) {
      globalTrend.push({
        week: weekLabel,
        rate: validHabits > 0 ? Math.round(sumRates / validHabits) : 0
      })
    }
  }
  
  return globalTrend
}

export function isHabitScheduledOnDate(habit, dateStr) {
  if (!habit) return false
  if (habit.createdAt) {
    const createdStr = typeof habit.createdAt === 'string' 
      ? habit.createdAt.slice(0, 10) 
      : format(new Date(habit.createdAt), 'yyyy-MM-dd')
    if (dateStr < createdStr) return false
  }
  const dayIdx = new Date(`${dateStr}T00:00:00`).getDay()
  if (!habit.frequencyType || habit.frequencyType === 'daily' || habit.frequencyType === 'weekly') {
    return true
  }
  if (habit.frequencyType === 'specific_days' && Array.isArray(habit.frequencyValue)) {
    return habit.frequencyValue.includes(dayIdx)
  }
  return false
}
