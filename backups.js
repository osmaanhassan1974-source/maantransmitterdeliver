const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
    createRemoteBackup,
    listRemoteBackups,
    getRemoteBackup
} = require("./supabase-store");

const backupDirectory = path.join(__dirname, "data", "backups");

function ensureBackupDirectory() {
    fs.mkdirSync(backupDirectory, { recursive: true });
}

function safeBackupName(filename) {
    return typeof filename === "string"
        && path.basename(filename) === filename
        && /^maan-backup-(manual|automatic|pre-restore)-[0-9TZ-]+\.json$/.test(filename);
}

function createBackup(database, type = "manual") {
    if (!["manual", "automatic", "pre-restore"].includes(type)) {
        throw new Error("Backup type is not supported.");
    }

    ensureBackupDirectory();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `maan-backup-${type}-${stamp}.json`;
    const destination = path.join(backupDirectory, filename);
    const temporary = `${destination}.${crypto.randomBytes(6).toString("hex")}.tmp`;

    try {
        fs.writeFileSync(temporary, JSON.stringify(database, null, 2), { flag: "wx" });
        fs.renameSync(temporary, destination);
    } catch (error) {
        try {
            if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        } catch (cleanupError) {
            console.error("Could not remove incomplete backup file:", cleanupError);
        }
        throw error;
    }

    const stats = fs.statSync(destination);
    return {
        filename,
        type,
        createdAt: stats.mtime.toISOString(),
        size: stats.size
    };
}

async function createBackupAsync(database, type = "manual") {
    if (process.env.NETLIFY) return createRemoteBackup(database, type);
    return createBackup(database, type);
}

function listBackups() {
    ensureBackupDirectory();
    return fs.readdirSync(backupDirectory, { withFileTypes: true })
        .filter(entry => entry.isFile() && safeBackupName(entry.name))
        .map(entry => {
            const stats = fs.statSync(path.join(backupDirectory, entry.name));
            const type = entry.name.startsWith("maan-backup-pre-restore-")
                ? "pre-restore"
                : entry.name.split("-")[2];
            return {
                filename: entry.name,
                type,
                createdAt: stats.mtime.toISOString(),
                size: stats.size
            };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listBackupsAsync() {
    if (process.env.NETLIFY) return listRemoteBackups();
    return listBackups();
}

async function getBackupBufferAsync(filename) {
    if (process.env.NETLIFY) return getRemoteBackup(filename);
    const backupPath = getBackupPath(filename);
    if (!backupPath || !fs.existsSync(backupPath)) return null;
    return fs.promises.readFile(backupPath);
}

function getBackupPath(filename) {
    if (!safeBackupName(filename)) return null;
    return path.join(backupDirectory, filename);
}

function mogadishuDateKey(date = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Mogadishu",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(date instanceof Date ? date : new Date(date));
}

function nextMogadishuMidnightUtc() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Mogadishu",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const year = Number(parts.find(part => part.type === "year").value);
    const month = Number(parts.find(part => part.type === "month").value);
    const day = Number(parts.find(part => part.type === "day").value);
    return Date.UTC(year, month - 1, day + 1) - 3 * 60 * 60 * 1000;
}

module.exports = {
    createBackup,
    listBackups,
    getBackupPath,
    createBackupAsync,
    listBackupsAsync,
    getBackupBufferAsync,
    mogadishuDateKey,
    nextMogadishuMidnightUtc
};
