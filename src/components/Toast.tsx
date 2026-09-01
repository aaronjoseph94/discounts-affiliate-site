/** Bottom status chip. Safe-area padding lives in CSS so it clears the home indicator. */
type ToastProps = {
  message: string;
};

export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
