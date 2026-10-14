import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import type { Provider } from "next-auth/providers/index";

const list = (v?: string) =>
    (v ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export const oidcEnabled = Boolean(
    process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET
);
export const oidcName = process.env.OIDC_NAME || "SSO";
export const passwordEnabled =
    !oidcEnabled || process.env.OIDC_DISABLE_PASSWORD !== "true";

const allowedGroups = list(process.env.OIDC_ALLOWED_GROUPS);
const allowedEmails = list(process.env.OIDC_ALLOWED_EMAILS);
const groupsClaim = process.env.OIDC_GROUPS_CLAIM || "groups";

const providers: Provider[] = [];


if (oidcEnabled) {
    providers.push({
        id: "oidc",
        name: oidcName,
        type: "oauth",
        wellKnown: `${process.env.OIDC_ISSUER!.replace(/\/+$/, "")}/.well-known/openid-configuration`,
        clientId: process.env.OIDC_CLIENT_ID,
        clientSecret: process.env.OIDC_CLIENT_SECRET,
        authorization: { params: { scope: process.env.OIDC_SCOPE || "openid profile email" } },
        idToken: true,
        checks: ["pkce", "state"],
        profile(profile) {
            return {
                id: profile.sub,
                name: profile.name || profile.preferred_username || profile.email || profile.sub,
                email: profile.email,
                image: profile.picture,
            };
        },
    });
}

if (passwordEnabled) {
    providers.push(
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                // Validate environment variables at runtime (when someone tries to log in)
                if (!process.env.ADMIN_USERNAME) {
                    throw new Error("ADMIN_USERNAME environment variable is required");
                }
                if (!process.env.ADMIN_PASSWORD) {
                    throw new Error("ADMIN_PASSWORD environment variable is required");
                }

                const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
                const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

                if (
                    credentials?.username === ADMIN_USERNAME &&
                    credentials?.password === ADMIN_PASSWORD
                ) {
                    return { id: "1", name: ADMIN_USERNAME };
                }
                return null;
            },
        })
    );
}

export const authOptions: NextAuthOptions = {
    providers,
    callbacks: {
        async signIn({ account, profile, user }) {
            if (account?.provider !== "oidc") return true;
            if (allowedGroups.length === 0 && allowedEmails.length === 0) return true;

            const claims = (profile ?? {}) as Record<string, unknown>;
            const raw = claims[groupsClaim];
            const groups = (Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [])
                .map((g) => String(g).toLowerCase());
            const email = (user.email ?? "").toLowerCase();
            const emailVerified = claims.email_verified !== false;

            if (groups.some((g) => allowedGroups.includes(g))) return true;
            return Boolean(email) && emailVerified && allowedEmails.includes(email);
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: { strategy: "jwt" as const },
    secret: process.env.AUTH_SECRET,
};
