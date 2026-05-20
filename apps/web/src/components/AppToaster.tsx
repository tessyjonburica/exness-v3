import { Toaster } from "sonner";
import { useTheme } from "@/hooks/useTheme";

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      containerAriaLabel="Trade X notifications"
      closeButton
      position="top-right"
      richColors
      theme={theme === "dark" ? "dark" : "light"}
      toastOptions={{
        classNames: {
          toast: "font-[IBM_Plex_Mono] border border-gray-200 dark:border-gray-700",
          title: "font-extrabold",
          description: "text-sm",
        },
      }}
    />
  );
}
