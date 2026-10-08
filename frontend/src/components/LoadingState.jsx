export default function LoadingState() {
  return <span className="button-loading" role="status" aria-live="polite">
    <span className="button-spinner" aria-hidden="true" />Summarizing...
  </span>;
}
