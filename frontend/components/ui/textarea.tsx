import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"textarea">, "size"> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "textarea-primary w-full min-h-[80px]",
        size === "sm" && "h-[60px] px-3 py-1.5 text-sm",
        size === "lg" && "h-[100px] px-4 py-2.5 text-base",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
