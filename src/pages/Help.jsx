export default function Help() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Help & Documentation</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Get started with ValidUrchin and learn how to keep your UTM parameters clean.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="bg-white border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">Getting started</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Add the tracking snippet to your website and configure your allowed domains to begin
            capturing UTM events.
          </p>
          <a
            href="/settings/data-collection"
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            Go to Data Collection →
          </a>
        </div>

        <div className="bg-white border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">Setting up rules</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Define allowed values, casing requirements, and format standards for each UTM parameter.
            Use conditional rules for advanced logic.
          </p>
          <a
            href="/monitor/parameters"
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            Go to Monitor Settings →
          </a>
        </div>

        <div className="bg-white border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">Reviewing conflicts</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Conflicts are flagged when incoming UTM values don't match your rules. Review, resolve,
            or create auto-resolve rules to handle recurring issues.
          </p>
          <a
            href="/conflicts"
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            Go to Conflict Log →
          </a>
        </div>

        <div className="bg-white border border-zinc-200 p-6">
          <h2 className="text-sm font-semibold text-zinc-900 mb-1">Need more help?</h2>
          <p className="text-sm text-zinc-500 mb-3">
            Our team is available to help with setup, integrations, and best practices.
          </p>
          <a
            href="mailto:sales@validurchin.com"
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            Contact us →
          </a>
        </div>
      </div>
    </div>
  )
}
