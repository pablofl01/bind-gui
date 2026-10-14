import { spawn } from "child_process";

const DNS_HOST = process.env.BIND_DNS_HOST || "127.0.0.1";
const DNS_PORT = process.env.BIND_DNS_PORT || "53";
const TSIG_KEY_FILE = process.env.TSIG_KEY_FILE || "/etc/bind/bind-gui.key";
const TIMEOUT_MS = 10_000;

/**
 * Remote mode: BIND runs on another machine and bind-gui has no access to its
 * config directory or rndc. Zones are listed in BIND_ZONES (comma-separated)
 * and their contents are read with an AXFR authenticated by the TSIG key.
 */
export function remoteZones(): string[] | null {
    const raw = process.env.BIND_ZONES;
    if (!raw || !raw.trim()) return null;
    return raw
        .split(",")
        .map((z) => z.trim().replace(/\.$/, ""))
        .filter((z) => /^[a-zA-Z0-9._-]+$/.test(z));
}

export function isRemoteMode(): boolean {
    return remoteZones() !== null;
}

export class AxfrError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AxfrError";
    }
}

function runDig(domain: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            "dig",
            [
                "-k", TSIG_KEY_FILE,
                "-p", DNS_PORT,
                `@${DNS_HOST}`,
                domain, "AXFR",
                "+noall", "+answer", "+nottlunits",
            ],
            { timeout: TIMEOUT_MS, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
        child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
        child.on("error", (err) => reject(new AxfrError(err.message)));
        child.on("close", (code) => {
            // dig exits 0 even on a refused transfer, so an empty answer is also a failure.
            if (code !== 0 || !stdout.trim()) {
                reject(new AxfrError(
                    `AXFR of ${domain} failed: ${(stderr || stdout).trim() || `exit code ${code}`}`,
                ));
                return;
            }
            resolve(stdout);
        });
    });
}

/**
 * Transfer a zone and return it as zone-file text in the shape parseZoneFile
 * expects: relative owner names, per-record TTL kept, no SOA.
 */
export async function axfrZoneContent(domain: string): Promise<string> {
    if (!remoteZones()?.includes(domain)) {
        throw new AxfrError(`Zone ${domain} is not listed in BIND_ZONES`);
    }
    const output = await runDig(domain);
    const ttlCounts = new Map<number, number>();
    const lines: string[] = [];

    for (const raw of output.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith(";")) continue;
        const m = line.match(/^(\S+)\s+(\d+)\s+IN\s+(\S+)\s+(.*)$/);
        if (!m) continue;
        const [, owner, ttlStr, type, rdata] = m;
        if (type === "SOA") continue;

        const ttl = parseInt(ttlStr, 10);
        ttlCounts.set(ttl, (ttlCounts.get(ttl) ?? 0) + 1);

        const ownerNoDot = owner.replace(/\.$/, "");
        let name: string;
        if (ownerNoDot === domain) name = "@";
        else if (ownerNoDot.endsWith(`.${domain}`)) name = ownerNoDot.slice(0, -(domain.length + 1));
        else name = owner;

        lines.push(`${name} ${ttl} IN ${type} ${rdata}`);
    }

    let ttl = 3600;
    let best = 0;
    for (const [t, count] of ttlCounts) {
        if (count > best) { best = count; ttl = t; }
    }

    return `$TTL ${ttl}\n${lines.join("\n")}\n`;
}
