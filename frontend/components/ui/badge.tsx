import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "@/lib/utils"

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost"
}) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(
          "badge",
          variant === "default" && "badge-primary",
          variant === "secondary" && "badge-secondary",
          variant === "destructive" && "badge-destructive",
          variant === "outline" && "badge-outline",
          variant === "ghost" && "badge-ghost",
          className
        ),
      },
      props
    ),
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge }
