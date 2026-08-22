"use client";

import { ReactNode } from "react";

export default function AppProviders({
  children
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}