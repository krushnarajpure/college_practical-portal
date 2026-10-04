export default function WorkspaceLoading({ title = 'Preparing your workspace', description = 'Loading your academic records and assignments.' }) {
  return <section className="workspace-loading" role="status" aria-live="polite" aria-label={title}>
    <div className="workspace-loading-content">
      <span className="workspace-loading-spinner" aria-hidden="true" />
      <h2>{title}</h2>
      <p className="workspace-loading-description">{description}</p>
    </div>
  </section>;
}
