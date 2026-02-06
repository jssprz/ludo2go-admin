// app/(whatever)/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./login_client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}