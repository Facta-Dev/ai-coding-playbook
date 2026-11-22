// <app> — the ui-kit button.
//
// One button, two intensities, no app logic: the views pass text, variant and
// handler, the kit renders markup (docs/03-layers-and-mvvm — views compose
// ui-kit, ui-kit knows nothing about features).

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps
  extends Pick<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "type" | "onClick"> {
  readonly variant?: ButtonVariant;
  readonly children: ReactNode;
}

export function Button({ variant = "primary", children, ...rest }: ButtonProps) {
  return (
    <button type="button" className="ui-kit-button" data-variant={variant} {...rest}>
      {children}
    </button>
  );
}
