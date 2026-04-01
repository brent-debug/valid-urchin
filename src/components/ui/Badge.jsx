const variants = {
  active: 'bg-teal-50 text-teal-700',
  paused: 'bg-amber-50 text-amber-700',
  draft: 'bg-zinc-100 text-zinc-500',
  error: 'bg-red-50 text-red-600',
  open: 'bg-red-50 text-red-600',
  owner: 'bg-teal-50 text-teal-700',
  admin: 'bg-blue-50 text-blue-700',
  member: 'bg-zinc-100 text-zinc-600',
  viewer: 'bg-zinc-100 text-zinc-400',
  // New role variants
  manager: 'bg-blue-50 text-blue-700',
  user: 'bg-zinc-100 text-zinc-600',
}

export default function Badge({ variant = 'draft', children }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.draft}`}>
      {children}
    </span>
  )
}
