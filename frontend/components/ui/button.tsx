import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/50",
        outline:
          "border border-border bg-background/50 hover:bg-background/70 hover:text-foreground aria-expanded:bg-background/70 aria-expanded:text-foreground dark:border-input/50 dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90 focus-visible:ring-secondary/50",
        ghost:
          "hover:bg-background/50 hover:text-foreground aria-expanded:bg-background/50 aria-expanded:text-foreground dark:hover:bg-background/50",
        destructive:
          "bg-destructive text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/50 dark:bg-destructive/40 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 px-4 py-2 gap-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 text-sm",
        xs: "h-8 px-3 py-1.5 gap-1.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1 text-xs in-data-[slot=button-group]:rounded-lg",
        sm: "h-9 px-3.5 py-1.75 gap-2 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-1.5 text-[0.875rem] in-data-[slot=button-group]:rounded-lg",
        lg: "h-11 px-4.5 py-2.5 gap-3 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "h-10 w-10",
        "icon-xs":
          "h-8 w-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "h-9 w-9 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & {
  asChild?: boolean
}) {
  const Component = asChild ? ButtonPrimitive : "button"
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
