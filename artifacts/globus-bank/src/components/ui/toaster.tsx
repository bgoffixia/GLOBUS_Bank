import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={5000}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} className="rounded-xl border-[#dfe7ec] bg-white p-3 pr-9 text-[#203851] shadow-[0_12px_32px_rgba(19,46,76,.16)]" {...props}>
            <div className="grid min-w-0 gap-0.5">
              {title && <ToastTitle className="text-[11px] leading-4">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-[10px] leading-4">{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
