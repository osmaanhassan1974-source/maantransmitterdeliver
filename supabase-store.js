const backupNamePattern = /^maan-backup-(manual|automatic|pre-restore)-[0-9TZ-]+\.json$/;
const stateId = "main";

function getSupabaseConfig() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
    }
    return { url: url.replace(/\/+$/, ""), serviceKey };
}

async function supabaseRequest(path, options = {}) {
    const { url, serviceKey } = getSupabaseConfig();
    const response = await fetch(`${url}${path}`, {
        ...options,
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });
    if (!response.ok) {
        const detail = await response.text();
        const error = new Error(`Supabase request failed (${response.status}): ${detail.slice(0, 500)}`);
        error.status = response.status;
        throw error;
    }
    return response;
}

async function loadApplicationState() {
    const response = await supabaseRequest(
        `/rest/v1/application_state?id=eq.${encodeURIComponent(stateId)}&select=id,version,data`
    );
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("Supabase database is not initialized. Run the local migration script before deploying.");
    }
    return { data: rows[0].data, revision: Number(rows[0].version) };
}

async function saveApplicationState(data, expectedRevision) {
    const response = await supabaseRequest("/rest/v1/rpc/update_application_state", {
        method: "POST",
        body: JSON.stringify({
            p_expected_version: expectedRevision,
            p_data: data
        })
    });
    const revision = await response.json();
    if (!Number.isSafeInteger(Number(revision))) {
        throw new Error("Supabase returned an invalid database revision.");
    }
    return Number(revision);
}

function safeBackupName(filename) {
    return typeof filename === "string" && backupNamePattern.test(filename);
}

async function createRemoteBackup(database, type) {
    if (!["manual", "automatic", "pre-restore"].includes(type)) {
        throw new Error("Backup type is not supported.");
    }
    const now = new Date();
    const filename = `maan-backup-${type}-${now.toISOString().replace(/[:.]/g, "-")}.json`;
    const { url, serviceKey } = getSupabaseConfig();
    const response = await fetch(`${url}/storage/v1/object/database-backups/${encodeURIComponent(filename)}`, {
        method: "POST",
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            "x-upsert": "false"
        },
        body: JSON.stringify(database, null, 2)
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Supabase backup upload failed (${response.status}): ${detail.slice(0, 500)}`);
    }
    const text = JSON.stringify(database);
    return {
        filename,
        type,
        createdAt: now.toISOString(),
        size: Buffer.byteLength(text, "utf8")
    };
}

async function listRemoteBackups() {
    const response = await supabaseRequest("/storage/v1/object/list/database-backups", {
        method: "POST",
        body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } })
    });
    const items = await response.json();
    return items
        .filter(item => item && safeBackupName(item.name))
        .map(item => {
            const name = item.name;
            const type = name.startsWith("maan-backup-pre-restore-") ? "pre-restore" : name.split("-")[2];
            return {
                filename: name,
                type,
                createdAt: item.created_at || item.updated_at || "",
                size: Number(item.metadata && item.metadata.size) || 0
            };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function getRemoteBackup(filename) {
    if (!safeBackupName(filename)) return null;
    const { url, serviceKey } = getSupabaseConfig();
    const response = await fetch(`${url}/storage/v1/object/database-backups/${encodeURIComponent(filename)}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    });
    if (response.status === 404) return null;
    if (!response.ok) {
        const detail = await response.text();
        if (response.status === 400 && /object not found/i.test(detail)) return null;
        throw new Error(`Supabase backup download failed (${response.status}): ${detail.slice(0, 500)}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

module.exports = {
    getSupabaseConfig,
    loadApplicationState,
    saveApplicationState,
    safeBackupName,
    createRemoteBackup,
    listRemoteBackups,
    getRemoteBackup
};
