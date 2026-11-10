"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Supabase redirect com code de confirmação — tentar fazer sign-in implícito
    // ou apenas redirecionar para login com mensagem
    router.push("/login");
  }, [router]);

  return null;
}
