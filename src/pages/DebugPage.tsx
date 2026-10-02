// Not linked from navigation. Lets Steve confirm which build/commit a
// deployed environment (e.g. the beta URL) is currently serving.
function DebugPage() {
  return (
    <section>
      <h1>Build info</h1>
      <dl>
        <dt>Commit</dt>
        <dd>{__APP_COMMIT_SHA__}</dd>
        <dt>Built</dt>
        <dd>{__APP_BUILD_TIME__}</dd>
      </dl>
    </section>
  )
}

export default DebugPage
