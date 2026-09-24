"use client";

import { useEffect, useState } from "react";
import { establishPrivateSession } from "@/lib/pwa/private-data";

export function PrivateSessionGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [readyUser, setReadyUser] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    establishPrivateSession(userId).then(
      () => { if (active) setReadyUser(userId); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [userId]);

  if (readyUser !== userId) return <p role={failed ? "alert" : "status"}>{failed ? "No se pudo limpiar el almacenamiento local. Cierra otras pestañas de Neverita y recarga." : "Preparando tus datos locales…"}</p>;
  return children;
}
