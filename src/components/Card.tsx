import { HTMLAttributes, Ref } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function Card({ className = "", children, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={["rounded-2xl border border-brand-100 bg-white p-5 shadow-sm", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
