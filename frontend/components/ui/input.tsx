import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "input-primary w-full",
        size === "sm" && "h-9 px-3 py-1.5 text-sm",
        size === "lg" && "h-11 px-4 py-2.5 text-base",
        className
      )}
      {...props}
    />
  )
}

export { Input }