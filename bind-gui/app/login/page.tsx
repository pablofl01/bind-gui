import { Suspense } from "react";
import LoginForm from "./login-form";
import { oidcEnabled, oidcName, passwordEnabled } from "@/lib/authOptions";

export const dynamic = "force-dynamic";

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm oidcName={oidcEnabled ? oidcName : null} passwordEnabled={passwordEnabled} />
        </Suspense>
    );
}
