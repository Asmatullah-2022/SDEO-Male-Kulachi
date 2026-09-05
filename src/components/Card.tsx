import { HTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["rounded-2xl border border-brand-100 bg-white p-5 shadow-sm", className].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
