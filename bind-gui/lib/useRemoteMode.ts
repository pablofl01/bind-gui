"use client";

import { useEffect, useState } from "react";

/** True when bind-gui reads zones via AXFR (no rndc / config dir access). */
export function useRemoteMode(): boolean {
    const [remote, setRemote] = useState(false);
    useEffect(() => {
        fetch("/api/version")
            .then((r) => r.json())
            .then((d) => setRemote(Boolean(d.remote)))
            .catch(() => {});
    }, []);
    return remote;
}
