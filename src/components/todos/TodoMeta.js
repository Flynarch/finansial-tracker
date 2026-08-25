import {
  Receipt,
  TrendingUp,
  ShoppingBag,
  Landmark,
  Briefcase,
  User,
  HeartPulse,
  GraduationCap,
  Home,
  Car,
  Folder,
} from 'lucide-react'

export const TODO_CATEGORIES = [
  'tagihan',
  'investasi',
  'belanja',
  'tabungan',
  'pekerjaan',
  'pribadi',
  'kesehatan',
  'pendidikan',
  'rumah',
  'transportasi',
  'lainnya',
]

export const TODO_CATEGORY_META = {
  tagihan: { icon: Receipt, color: 'text-amber-500', bg: 'bg-amber-500/15' },
  investasi: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/15' },
  belanja: { icon: ShoppingBag, color: 'text-sky-500', bg: 'bg-sky-500/15' },
  tabungan: { icon: Landmark, color: 'text-indigo-500', bg: 'bg-indigo-500/15' },
  pekerjaan: { icon: Briefcase, color: 'text-violet-500', bg: 'bg-violet-500/15' },
  pribadi: { icon: User, color: 'text-pink-500', bg: 'bg-pink-500/15' },
  kesehatan: { icon: HeartPulse, color: 'text-rose-500', bg: 'bg-rose-500/15' },
  pendidikan: { icon: GraduationCap, color: 'text-cyan-500', bg: 'bg-cyan-500/15' },
  rumah: { icon: Home, color: 'text-orange-500', bg: 'bg-orange-500/15' },
  transportasi: { icon: Car, color: 'text-teal-500', bg: 'bg-teal-500/15' },
  lainnya: { icon: Folder, color: 'text-slate-400', bg: 'bg-slate-500/15' },
}

export function priorityClass(p) {
  if (p === 'high') return 'bg-rose-500'
  if (p === 'medium') return 'bg-amber-400'
  return 'bg-slate-400'
}
