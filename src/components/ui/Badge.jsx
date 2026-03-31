const variants = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  draft: 'bg-zinc-100 text-zinc-600',
  error: 'bg-red-100 text-red-700',
  owner: 'bg-primary-100 text-primary-700',
  admin: 'bg-blue-100 text-blue-700',
  member: 'bg-zinc-100 text-zinc-600',
  viewer: 'bg-zinc-100 text-zinc-500',
}

export default function Badge({ variant = 'draft', children }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant] || variants.draft}`}>
      {children}
    </span>
  )
}
