import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { isRemoteMode } from "@/lib/axfr";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const packageJsonPath = join(process.cwd(), "package.json");
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

        const version = packageJson.version || "unknown";
        const appName = packageJson.name || "bind-dns-gui";

        return NextResponse.json({
            name: appName,
            version: version,
            remote: isRemoteMode(),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json(
            {
                name: "bind-dns-gui",
                version: "unknown",
                error: "Failed to read version",
            },
            { status: 500 }
        );
    }
}
