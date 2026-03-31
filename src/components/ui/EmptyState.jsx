export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-5xl mb-4">{icon}</div>}
      <h3 className="text-base font-semibold text-zinc-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-zinc-500 mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
