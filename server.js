// ==========================================
// MAAN TRANSMITTER & DELIVER
// SERVER.JS - DATABASE CONNECTION
// ==========================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const {
    createBackup,
    listBackups,
    getBackupPath,
    createBackupAsync,
    listBackupsAsync,
    getBackupBufferAsync,
    mogadishuDateKey,
    nextMogadishuMidnightUtc
} = require("./backups");

const {
    createDatabase,
    readDatabase,
    saveDatabase,
    addRecord,
    findById,
    deleteById,
    updateById,
    generateId,
    currentDate
} = require("./database");
const {
    createAdmin,
    login,
    requireAuth
} = require("./auth");

const app = express();

const PORT = process.env.PORT || 3000;


// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    next();
});

app.use((req, res, next) => {
    if (req.netlifyBodyError) {
        return res.status(req.netlifyBodyError).json({
            success: false,
            message: req.netlifyBodyError === 413 ? "Codsigu wuxuu ka weyn yahay xadka la oggol yahay." : "JSON-ka la soo diray sax ma aha."
        });
    }
    next();
});

app.use(express.json({ limit: "100mb" }));

app.use(express.urlencoded({
    extended: true
}));


// ==========================================
// FRONTEND
// ==========================================

app.get(["/", "/index.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/app.js", (req, res) => {
    res.sendFile(path.join(__dirname, "app.js"));
});
app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/api/public/branding", (req, res) => {
    try {
        const settings = readDatabase().settings || {};
        res.setHeader("Cache-Control", "no-store");
        return res.json({
            success: true,
            data: {
                companyName: settings.companyName || "Maan Transmitter & Deliver",
                logo: typeof settings.logo === "string" ? settings.logo : ""
            }
        });
    } catch (error) {
        console.error("Public login branding load failed:", error);
        return res.status(500).json({ success: false, message: "Company branding could not be loaded." });
    }
});


// ==========================================
// CREATE DATABASE
// ==========================================
// ==========================================
// LOGIN API
// ==========================================

const loginAttempts = new Map();
const registrationAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const loginAttemptLimit = 10;
const registrationAttemptLimit = 5;

app.post("/api/login", async (req, res) => {

    try {
        const now = Date.now();
        const clientKey = req.ip || req.socket.remoteAddress || "unknown";
        const attempts = (loginAttempts.get(clientKey) || []).filter(time => now - time < loginWindowMs);
        if (attempts.length >= loginAttemptLimit) {
            res.setHeader("Retry-After", String(Math.ceil((loginWindowMs - (now - attempts[0])) / 1000)));
            return res.status(429).json({
                success: false,
                message: "Isku dayo badan ayaa dhacay. Sug wax yar ka hor intaadan mar kale gelin."
            });
        }
        const requestBody = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
        const { email, identifier, password } = requestBody;
        const loginIdentifier = String(identifier || email || "").trim();

        if (!loginIdentifier || !password) {

            return res.status(400).json({

                success: false,

                message: "Email iyo password waa muhiim."

            });

        }

        const result = await login(
            loginIdentifier,
            password
        );

        if (!result.success) {
            attempts.push(now);
            loginAttempts.set(clientKey, attempts);
            return res.status(401).json(result);
        }

        loginAttempts.delete(clientKey);
        res.json(result);

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        res.status(500).json({

            success: false,

            message: "Server-ka ayaa cilad galay."

        });

    }

});

app.post("/api/register", async (req, res) => {
    try {
        const now = Date.now();
        const clientKey = req.ip || req.socket.remoteAddress || "unknown";
        const attempts = (registrationAttempts.get(clientKey) || []).filter(time => now - time < loginWindowMs);
        if (attempts.length >= registrationAttemptLimit) {
            res.setHeader("Retry-After", String(Math.ceil((loginWindowMs - (now - attempts[0])) / 1000)));
            return res.status(429).json({
                success: false,
                message: "Isku dayo badan oo akoon samayn ah ayaa dhacay. Mar dambe isku day."
            });
        }

        const requestBody = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
        const name = typeof requestBody.name === "string" ? requestBody.name.trim() : "";
        const phone = typeof requestBody.phone === "string" ? requestBody.phone.trim() : "";
        const email = typeof requestBody.email === "string" ? requestBody.email.trim().toLowerCase() : "";
        const username = typeof requestBody.username === "string" ? requestBody.username.trim().toLowerCase() : "";
        const password = typeof requestBody.password === "string" ? requestBody.password : "";

        if (!name || name.length > 100 || !/^[+()\d\s.-]{7,25}$/.test(phone)
            || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            || !/^[a-z0-9._-]{3,30}$/.test(username)
            || password.length < 12 || password.length > 128) {
            attempts.push(now);
            registrationAttempts.set(clientKey, attempts);
            return res.status(400).json({
                success: false,
                message: "Hubi magaca, telefoonka, email-ka, username-ka iyo password-ka (ugu yaraan 12 xaraf)."
            });
        }

        const database = readDatabase();
        const duplicateEmail = database.users.some(user => user.email.toLowerCase() === email);
        const duplicateUsername = database.users.some(user => user.username && user.username.toLowerCase() === username);
        if (duplicateEmail || duplicateUsername) {
            attempts.push(now);
            registrationAttempts.set(clientKey, attempts);
            return res.status(409).json({
                success: false,
                message: duplicateEmail ? "Email-kan horey ayaa loo isticmaalay." : "Username-kan horey ayaa loo isticmaalay."
            });
        }

        let id = generateId("USR");
        while (database.users.some(user => user.id === id)) id = generateId("USR");
        const user = {
            id,
            name,
            phone,
            email,
            username,
            password: await bcrypt.hash(password, 12),
            role: "staff",
            avatar: "",
            createdAt: currentDate()
        };
        database.users.push(user);
        saveDatabase(database);
        registrationAttempts.delete(clientKey);

        const result = await login(username, password);
        return res.status(201).json({
            ...result,
            message: "Akoonka waa la sameeyay. Soo dhawoow!",
            user: result.user
        });
    } catch (error) {
        console.error("Account registration error:", error);
        return res.status(500).json({ success: false, message: "Akoon lama samayn karin. Mar kale isku day." });
    }
});
// ==========================================
// API HOME
// ==========================================

app.get("/api", (req, res) => {

    res.json({

        success: true,

        message:
            "Maan Transmitter & Deliver API waa shaqeynayaa.",

        company:
            "Maan Transmitter & Deliver",

        country:
            "Somalia"

    });

});

app.use("/api", requireAuth);

function mogadishuMonthKey(value) {
    if (!value) return null;
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Mogadishu",
        year: "numeric",
        month: "2-digit"
    }).formatToParts(date);
    const year = parts.find(part => part.type === "year")?.value;
    const month = parts.find(part => part.type === "month")?.value;
    return year && month ? `${year}-${month}` : null;
}

function previousMonthKey(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const previous = new Date(Date.UTC(year, month - 2, 1));
    return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextMonthStartUtc() {
    const now = new Date();
    const localParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Mogadishu",
        year: "numeric",
        month: "2-digit"
    }).formatToParts(now);
    const year = Number(localParts.find(part => part.type === "year").value);
    const month = Number(localParts.find(part => part.type === "month").value);
    return Date.UTC(year, month, 1) - (3 * 60 * 60 * 1000);
}

function closeCompletedMonths() {
    const database = readDatabase();
    database.monthlyClosings = database.monthlyClosings || [];
    database.reports = database.reports || [];

    const currentMonth = mogadishuMonthKey(new Date());
    const lastCompletedMonth = previousMonthKey(currentMonth);
    const datedRecords = [
        ...(database.orders || []).map(item => item.createdAt),
        ...(database.payments || []).map(item => item.date || item.createdAt),
        ...(database.expenses || []).map(item => item.date || item.createdAt),
        ...(database.deliveries || []).map(item => item.createdAt),
        ...(database.shipments || []).map(item => item.createdAt),
        ...(database.monthlyBills || []).map(item => item.dueDate || item.createdAt)
    ].map(mogadishuMonthKey).filter(Boolean).filter(month => month <= lastCompletedMonth).sort();

    let monthToClose = datedRecords[0] || lastCompletedMonth;
    const newClosings = [];
    while (monthToClose <= lastCompletedMonth) {
        const alreadyClosed = database.monthlyClosings.some(item => item.period === monthToClose);
        if (!alreadyClosed) {
            const inMonth = date => mogadishuMonthKey(date) === monthToClose;
            const payments = (database.payments || []).filter(item => inMonth(item.date || item.createdAt));
            const expenses = (database.expenses || []).filter(item => inMonth(item.date || item.createdAt));
            const orders = (database.orders || []).filter(item => inMonth(item.createdAt));
            const revenue = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const billed = orders.reduce((sum, item) => sum + Number(item.totalAmount || item.amount || 0), 0);
            const closedAt = currentDate();
            const closing = {
                id: generateId("CLS"),
                period: monthToClose,
                status: "closed",
                revenue,
                expenses: expenseTotal,
                profit: revenue - expenseTotal,
                orderCount: orders.length,
                billed,
                closedAt,
                closedBy: "system"
            };
            const report = {
                id: generateId("RPT"),
                title: `Monthly Closing — ${monthToClose}`,
                category: "Finance",
                status: "Published",
                summary: `Monthly report for ${monthToClose}\nRevenue: ${revenue.toFixed(2)}\nExpenses: ${expenseTotal.toFixed(2)}\nProfit / Loss: ${(revenue - expenseTotal).toFixed(2)}\nOrders: ${orders.length}\nBilled: ${billed.toFixed(2)}`,
                createdAt: closedAt,
                autoGenerated: "monthly-closing",
                period: monthToClose,
                closingId: closing.id
            };
            closing.reportId = report.id;
            database.monthlyClosings.push(closing);
            database.reports.push(report);
            newClosings.push(monthToClose);
        }

        const [year, month] = monthToClose.split("-").map(Number);
        const next = new Date(Date.UTC(year, month, 1));
        monthToClose = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    }

    if (newClosings.length) {
        saveDatabase(database);
        newClosings.forEach(month => console.log(`Monthly closing generated for ${month} (Africa/Mogadishu).`));
    }
}

function monthlyClosingScheduler() {
    const maxTimeout = 2 ** 31 - 1;
    const delay = Math.min(maxTimeout, Math.max(1000, nextMonthStartUtc() - Date.now() + 1000));
    setTimeout(runScheduledMonthlyClosing, delay).unref();
}

function runScheduledMonthlyClosing() {
    try {
        closeCompletedMonths();
        monthlyClosingScheduler();
    } catch (error) {
        console.error("Automatic monthly closing failed; retrying in one minute:", error);
        setTimeout(runScheduledMonthlyClosing, 60 * 1000).unref();
    }
}

function ensureDailyBackup() {
    const today = mogadishuDateKey();
    const hasBackup = listBackups().some(backup =>
        backup.type === "automatic" && mogadishuDateKey(backup.createdAt) === today
    );
    if (!hasBackup) {
        const backup = createBackup(readDatabase(), "automatic");
        console.log(`Automatic database backup created: ${backup.filename}`);
    }
}

function dailyBackupScheduler() {
    const maxTimeout = 2 ** 31 - 1;
    const delay = Math.min(maxTimeout, Math.max(1000, nextMogadishuMidnightUtc() - Date.now() + 1000));
    setTimeout(runDailyBackup, delay).unref();
}

function runDailyBackup() {
    try {
        ensureDailyBackup();
        dailyBackupScheduler();
    } catch (error) {
        console.error("Automatic database backup failed; retrying in one minute:", error);
        setTimeout(runDailyBackup, 60 * 1000).unref();
    }
}

function requireAdmin(req, res, next) {
    const database = readDatabase();
    const user = database.users.find(item => item.id === req.user.id);
    if (!user || user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Maamulaha keliya ayaa isticmaali kara adeeggan."
        });
    }
    next();
}

function getExportDatabase() {
    const database = readDatabase();
    return {
        ...database,
        users: (database.users || []).map(({ password, ...user }) => user)
    };
}

function exportRows(value) {
    if (Array.isArray(value)) return value;
    return [value];
}

function normalizeExportValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return value;
}

function safeCsvCell(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

app.get("/api/admin/exports/:format", requireAdmin, (req, res) => {
    const format = req.params.format.toLowerCase();
    if (!["xlsx", "csv", "pdf"].includes(format)) {
        return res.status(400).json({ success: false, message: "Export format-ku waa inuu noqdaa Excel, CSV ama PDF." });
    }

    const data = getExportDatabase();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `maan-full-data-${date}.${format}`;

    if (format === "xlsx") {
        try {
            const workbook = XLSX.utils.book_new();
            Object.entries(data).forEach(([name, value]) => {
                const rows = exportRows(value).map(row => {
                    if (!row || typeof row !== "object" || Array.isArray(row)) return { Value: normalizeExportValue(row) };
                    const excelRow = {};
                    Object.entries(row).forEach(([key, item]) => {
                        if (key === "password") return;
                        const cellValue = normalizeExportValue(item);
                        if (typeof cellValue !== "string" || cellValue.length <= 32767) {
                            excelRow[key] = cellValue;
                            return;
                        }
                        for (let offset = 0, part = 1; offset < cellValue.length; offset += 32767, part += 1) {
                            excelRow[part === 1 ? key : `${key} (continued ${part})`] = cellValue.slice(offset, offset + 32767);
                        }
                    });
                    return excelRow;
                });
                XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
            });
            const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            return res.send(output);
        } catch (error) {
            console.error("Excel data export failed:", error);
            return res.status(500).json({ success: false, message: "Xogta Excel ahaan looma export-gareyn karin." });
        }
    }

    if (format === "csv") {
        const rows = [["Collection", "Record ID", "Data"]];
        Object.entries(data).forEach(([collection, value]) => {
            exportRows(value).forEach(record => {
                const id = record && typeof record === "object" ? record.id || "" : "";
                rows.push([collection, id, JSON.stringify(record)]);
            });
        });
        const csv = `\uFEFF${rows.map(row => row.map(safeCsvCell).join(",")).join("\r\n")}`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(csv);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const document = new PDFDocument({ autoFirstPage: true, margin: 42, size: "A4" });
    document.pipe(res);
    document.fontSize(18).font("Helvetica-Bold").text("Maan Transmitter & Deliver", { continued: false });
    document.moveDown(0.35).fontSize(10).font("Helvetica").text(`Full data export — ${new Date().toISOString()}`);
    document.moveDown();

    const addLine = (text, bold = false) => {
        if (document.y > document.page.height - document.page.margins.bottom - 48) document.addPage();
        const printable = String(text).replace(/[^\x20-\xFF]/g, " ");
        document.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 8).text(printable, {
            width: document.page.width - document.page.margins.left - document.page.margins.right,
            lineGap: 2
        });
    };

    Object.entries(data).forEach(([collection, value]) => {
        document.moveDown(0.5);
        addLine(collection, true);
        exportRows(value).forEach(record => {
            const printableRecord = record && typeof record === "object"
                ? Object.fromEntries(Object.entries(record).map(([key, item]) => [
                    key,
                    typeof item === "string" && item.startsWith("data:image/")
                        ? "[image data omitted from PDF; use Excel/CSV or database backup]"
                        : item
                ]))
                : record;
            addLine(JSON.stringify(printableRecord));
        });
    });
    document.end();
});

app.get("/api/admin/backups", requireAdmin, async (req, res) => {
    try {
        return res.json({ success: true, data: await listBackupsAsync() });
    } catch (error) {
        console.error("Database backup listing failed:", error);
        return res.status(500).json({ success: false, message: "Liiska backup-yada lama soo rari karin." });
    }
});

app.post("/api/admin/backups", requireAdmin, async (req, res) => {
    try {
        const backup = await createBackupAsync(readDatabase(), "manual");
        res.status(201).json({ success: true, message: "Database backup waa la sameeyay.", data: backup });
    } catch (error) {
        console.error("Manual database backup failed:", error);
        res.status(500).json({ success: false, message: "Backup-ka lama samayn karin." });
    }
});

app.get("/api/admin/backups/:filename/download", requireAdmin, async (req, res) => {
    if (process.env.NETLIFY) {
        try {
            const backup = await getBackupBufferAsync(req.params.filename);
            if (!backup) return res.status(404).json({ success: false, message: "Backup-ka lama helin." });
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Content-Disposition", `attachment; filename="${req.params.filename}"`);
            return res.send(backup);
        } catch (error) {
            console.error("Remote database backup download failed:", error);
            return res.status(500).json({ success: false, message: "Backup-ka lama soo dejisan karin." });
        }
    }

    const backupPath = getBackupPath(req.params.filename);
    if (!backupPath || !fs.existsSync(backupPath)) {
        return res.status(404).json({ success: false, message: "Backup-ka lama helin." });
    }
    res.download(backupPath, req.params.filename, error => {
        if (error && !res.headersSent) {
            console.error("Database backup download failed:", error);
            res.status(500).json({ success: false, message: "Backup-ka lama soo dejisan karin." });
        }
    });
});

function validateDatabaseBackup(database) {
    const requiredCollections = [
        "users", "customers", "orders", "deletedOrders", "shipments", "deliveries",
        "payments", "expenses", "income", "reports"
    ];
    if (!database || typeof database !== "object" || Array.isArray(database)
        || !database.settings || typeof database.settings !== "object" || Array.isArray(database.settings)) {
        return "Backup-ku ma aha database sax ah.";
    }
    for (const collection of requiredCollections) {
        if (!Array.isArray(database[collection])) return `Backup-ka waxaa ka maqan xogta saxda ah ee ${collection}.`;
    }
    if (database.monthlyClosings !== undefined && !Array.isArray(database.monthlyClosings)) {
        return "Xogta xisaab-xirka billaha ah ee backup-ku sax ma aha.";
    }
    if (database.monthlyBills !== undefined && !Array.isArray(database.monthlyBills)) {
        return "Xogta monthly bills-ka ee backup-ku sax ma aha.";
    }
    if (database.users.some(user => !user || typeof user !== "object" || !user.id || !user.email || !user.password)) {
        return "Xogta akoonnada ku jirta backup-ka ma saxna.";
    }
    return "";
}

app.post("/api/admin/backups/restore", requireAdmin, async (req, res) => {
    const errorMessage = validateDatabaseBackup(req.body);
    if (errorMessage) {
        return res.status(400).json({ success: false, message: errorMessage });
    }

    try {
        const safetyBackup = await createBackupAsync(readDatabase(), "pre-restore");
        const restoredDatabase = {
            ...req.body,
            monthlyClosings: req.body.monthlyClosings || []
        };
        saveDatabase(restoredDatabase);
        return res.json({
            success: true,
            message: "Backup-ka waa la restore-gareeyay. Database-kii ka horreeyayna backup badbaado ayaa loo sameeyay.",
            data: { safetyBackup: safetyBackup.filename }
        });
    } catch (error) {
        console.error("Database restore failed:", error);
        return res.status(500).json({ success: false, message: "Database-ka dib looma soo celin karin." });
    }
});

app.put("/api/admin/profile-settings", (req, res) => {
    const {
        name, email, phone, avatar, companyName, companyEmail, companyPhone,
        businessAddress, merchantAddress, businessDetails, logo
    } = req.body;

    if (!name || !email || !phone || !companyName) {
        return res.status(400).json({
            success: false,
            message: "Magaca, email-ka, telefoonka, iyo magaca shirkaddu waa in la buuxiyaa."
        });
    }
    if ([name, email, phone, companyName, companyEmail, companyPhone, businessAddress, merchantAddress, businessDetails]
        .some(value => typeof value === "string" && value.length > 20000)
        || [avatar, logo].some(value => typeof value === "string" && value.length > 8 * 1024 * 1024)) {
        return res.status(413).json({ success: false, message: "Xogta ama sawirka aad dirtay aad buu u weyn yahay." });
    }
    const validImage = value => value === undefined || value === ""
        || (typeof value === "string" && (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || /^https?:\/\//i.test(value)));
    if (!validImage(avatar) || !validImage(logo)) {
        return res.status(400).json({ success: false, message: "Sawirku waa inuu ahaadaa PNG, JPG ama WebP sax ah." });
    }

    const database = readDatabase();
    const user = database.users.find(item => item.id === req.user.id);
    if (!user) {
        return res.status(404).json({ success: false, message: "User-ka lama helin." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: "Email-ku sax ma aha." });
    }
    if (companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(companyEmail).trim())) {
        return res.status(400).json({ success: false, message: "Email-ka shirkaddu sax ma aha." });
    }
    const duplicateEmail = database.users.find(item => item.email.toLowerCase() === normalizedEmail && item.id !== req.user.id);
    if (duplicateEmail) {
        return res.status(409).json({ success: false, message: "Email-kan horeyba waa la isticmaalay." });
    }

    user.name = String(name).trim();
    user.email = normalizedEmail;
    user.phone = String(phone).trim();
    user.avatar = typeof avatar === "string" ? avatar : "";

    if (user.role === "admin") {
        database.settings = {
            ...(database.settings || {}),
            companyName: String(companyName).trim(),
            email: String(companyEmail || "").trim(),
            phone: String(companyPhone || "").trim(),
            companyPhone: String(companyPhone || "").trim(),
            businessAddress: String(businessAddress || "").trim(),
            merchantAddress: String(merchantAddress || "").trim(),
            businessDetails: String(businessDetails || "").trim(),
            logo: typeof logo === "string" ? logo : "",
            cashierImage: typeof avatar === "string" ? avatar : "",
            menuItems: (database.settings || {}).menuItems || {}
        };
    }

    saveDatabase(database);
    res.json({
        success: true,
        message: user.role === "admin"
            ? "Profile-ka iyo xogta ganacsiga waa la kaydiyay."
            : "Profile-ka waa la kaydiyay.",
        data: {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar
            },
            settings: database.settings || {}
        }
    });
});

app.get("/api/monthly-closings", (req, res) => {
    const database = readDatabase();
    res.json({
        success: true,
        data: database.monthlyClosings || []
    });
});

app.post("/api/monthly-closings/:period/reopen", requireAdmin, (req, res) => {
    const { period } = req.params;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
        return res.status(400).json({ success: false, message: "Bisha la doortay sax ma aha." });
    }

    const database = readDatabase();
    const closing = (database.monthlyClosings || []).find(item => item.period === period);
    if (!closing) {
        return res.status(404).json({ success: false, message: "Xisaab-xirka bishaan lama helin." });
    }
    if (closing.status === "reopened") {
        return res.status(409).json({ success: false, message: "Bishan horay ayaa dib loo furay." });
    }

    closing.status = "reopened";
    closing.reopenedAt = currentDate();
    closing.reopenedBy = req.user.id;
    saveDatabase(database);
    res.json({ success: true, message: `Bisha ${period} dib ayaa loo furay.`, data: closing });
});

function monthlyRecordCollection(pathname) {
    if (pathname.startsWith("/recycle-bin/orders/")) return ["deletedOrders", "createdAt"];
    if (pathname.startsWith("/orders")) return ["orders", "createdAt"];
    if (pathname.startsWith("/payments")) return ["payments", "date"];
    if (pathname.startsWith("/expenses")) return ["expenses", "date"];
    if (pathname.startsWith("/deliveries")) return ["deliveries", "createdAt"];
    if (pathname.startsWith("/shipments")) return ["shipments", "createdAt"];
    if (pathname.startsWith("/monthly-bills")) return ["monthlyBills", "dueDate"];
    if (pathname.startsWith("/reports")) return ["reports", "createdAt"];
    if (/^\/(customer|customers|order|orders|payment|payments|delivery|deliveries|shipment|shipments|monthly-bill|monthly-bills|report|reports)\//.test(pathname)) {
        const collection = pathname.split("/")[1];
        const aliases = {
            customer: "customers", order: "orders", payment: "payments",
            delivery: "deliveries", shipment: "shipments", "monthly-bill": "monthlyBills",
            report: "reports"
        };
        const normalized = aliases[collection] || collection;
        const dateField = normalized === "payments" || normalized === "expenses" ? "date"
            : normalized === "monthlyBills" ? "dueDate" : "createdAt";
        return [normalized, dateField];
    }
    return null;
}

function enforceMonthlyLocks(req, res, next) {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    if (req.path === "/monthly-closings" || req.path.startsWith("/monthly-closings/")) return next();

    const match = monthlyRecordCollection(req.path);
    if (!match) return next();
    const [collection, dateField] = match;
    if (collection === "customers") return next();

    const database = readDatabase();
    const rows = database[collection] || [];
    const id = req.path.startsWith("/recycle-bin/orders/")
        ? req.path.split("/")[3]
        : req.params.id || req.path.split("/").filter(Boolean).slice(-1)[0];
    const existing = id && id !== collection ? rows.find(item => item.id === id) : null;
    const candidates = [];
    if (existing) candidates.push(existing[dateField] || existing.createdAt);
    if (req.method === "POST") candidates.push(req.body?.[dateField] || req.body?.date || req.body?.createdAt || req.body?.dueDate || currentDate());
    else if (req.body && (req.body[dateField] || req.body.date || req.body.createdAt || req.body.dueDate)) {
        candidates.push(req.body[dateField] || req.body.date || req.body.createdAt || req.body.dueDate);
    }
    if (collection === "reports" && existing?.autoGenerated === "monthly-closing") {
        candidates.push(existing.period);
    }
    if (collection === "deliveries") {
        const orderId = existing?.orderId || req.body?.orderId;
        const linkedOrder = (database.orders || []).find(order => order.id === orderId);
        if (linkedOrder) candidates.push(linkedOrder.createdAt);
    }

    const lockedMonth = candidates.map(mogadishuMonthKey).find(month =>
        month && (database.monthlyClosings || []).some(closing => closing.period === month && closing.status !== "reopened")
    );
    if (lockedMonth) {
        return res.status(423).json({
            success: false,
            message: `Bisha ${lockedMonth} way xiran tahay. Maamulka ha dib u furo ka hor wax-ka-beddelka.`
        });
    }
    next();
}

app.use("/api", enforceMonthlyLocks);

// ==========================================
// DATABASE TEST
// ==========================================

app.get("/api/database", requireAdmin, (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        data: {
            ...database,
            users: (database.users || []).map(({ password, ...user }) => user)
        }

    });

});


// ==========================================
// DASHBOARD
// ==========================================

app.get("/api/dashboard", (req, res) => {

    const database =
        readDatabase();

    const orders =
        database.orders.length;

    const customers =
        database.customers.length;

    const deliveries =
        database.deliveries.length;

    const payments =
        database.payments.reduce(
            (total, payment) =>
                total + Number(payment.amount || 0),
            0
        );

    const expenses =
        database.expenses.reduce(
            (total, expense) =>
                total + Number(expense.amount || 0),
            0
        );

    const profit =
        payments - expenses;


    res.json({

        success: true,

        data: {

            orders,

            customers,

            deliveries,

            payments,

            expenses,

            profit

        }

    });

});

// ==========================================
// CUSTOMERS - GET
// ==========================================

app.get("/api/customers", (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        data: database.customers

    });

});


// ==========================================
// CUSTOMERS - ADD
// ==========================================

app.post("/api/customers", (req, res) => {

    const {
        name,
        phone,
        email,
        address
    } = req.body;


    if (!name || !phone) {

        return res.status(400).json({

            success: false,

            message:
                "Magaca iyo telefoonka waa muhiim."

        });

    }


    const customer = {

        id: generateId("CUS"),

        name,

        phone,

        email: email || "",

        address: address || "",

        createdAt:
            currentDate()

    };


    addRecord(
        "customers",
        customer
    );


    res.status(201).json({

        success: true,

        message:
            "Customer-ka waa la kaydiyay.",

        data: customer

    });

});

// ==========================================
// CUSTOMERS - UPDATE
// ==========================================

app.put("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.customers.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Customer-ka lama helin."
        });
    }

    const existingCustomer = database.customers[index];
    const updatedCustomer = {
        ...existingCustomer,
        ...req.body,
        id: existingCustomer.id,
        name: req.body.name || existingCustomer.name,
        phone: req.body.phone || existingCustomer.phone,
        email: req.body.email || existingCustomer.email || "",
        address: req.body.address || existingCustomer.address || "",
        updatedAt: currentDate()
    };

    database.customers[index] = updatedCustomer;
    saveDatabase(database);

    res.json({
        success: true,
        message: "Customer-ka waa la cusbooneysiiyay.",
        data: updatedCustomer
    });
});

// ==========================================
// CUSTOMERS - DELETE
// ==========================================

app.delete("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.customers.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Customer-ka lama helin."
        });
    }

    const [removed] = database.customers.splice(index, 1);
    saveDatabase(database);

    res.json({
        success: true,
        message: "Customer-ka waa la tirtiray.",
        data: removed
    });
});


// ==========================================
// ORDERS - GET
// ==========================================

app.get("/api/orders", (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        data: database.orders

    });

});

// ==========================================
// ORDERS - UPDATE
// ==========================================

app.put("/api/orders/:id", (req, res) => {

    const { id } = req.params;
    const database = readDatabase();
    const index = database.orders.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Order-ka lama helin."
        });
    }

    const existingOrder = database.orders[index];
    const updatedOrder = {
        ...existingOrder,
        ...req.body,
        id: existingOrder.id,
        customerName: req.body.customerName || existingOrder.customerName,
        phone: req.body.phone || existingOrder.phone,
        product: req.body.product || req.body.itemName || existingOrder.product,
        itemName: req.body.itemName || req.body.product || existingOrder.itemName || existingOrder.product,
        country: req.body.country || req.body.origin || existingOrder.country || existingOrder.origin,
        origin: req.body.origin || req.body.country || existingOrder.origin || existingOrder.country,
        recipientName: req.body.recipientName || existingOrder.recipientName,
        recipientPhone: req.body.recipientPhone || existingOrder.recipientPhone,
        recipientAddress: req.body.recipientAddress || existingOrder.recipientAddress,
        deliveryFee: Number(req.body.deliveryFee ?? existingOrder.deliveryFee ?? 0),
        totalAmount: Number(req.body.totalAmount ?? req.body.amount ?? existingOrder.totalAmount ?? existingOrder.amount ?? 0),
        amount: Number(req.body.amount ?? req.body.totalAmount ?? existingOrder.amount ?? existingOrder.totalAmount ?? 0),
        status: req.body.status || existingOrder.status,
        quantity: Number(req.body.quantity || existingOrder.quantity || 1),
        updatedAt: currentDate()
    };

    database.orders[index] = updatedOrder;
    saveDatabase(database);

    res.json({
        success: true,
        message: "Order-ka waa la cusbooneysiiyay.",
        data: updatedOrder
    });

});

// ==========================================
// ORDERS - DELETE (SOFT DELETE)
// ==========================================

app.delete("/api/orders/:id", (req, res) => {

    const { id } = req.params;
    const database = readDatabase();
    const index = database.orders.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Order-ka lama helin."
        });
    }

    const [deletedOrder] = database.orders.splice(index, 1);
    const recycleEntry = {
        ...deletedOrder,
        deletedAt: currentDate(),
        deletedBy: "admin"
    };

    database.deletedOrders = database.deletedOrders || [];
    database.deletedOrders.push(recycleEntry);
    saveDatabase(database);

    res.json({
        success: true,
        message: "Order-ka ayaa loo raray recycle bin.",
        data: recycleEntry
    });

});

// ==========================================
// RECYCLE BIN - GET
// ==========================================

app.get("/api/recycle-bin", (req, res) => {

    const database = readDatabase();

    res.json({
        success: true,
        data: database.deletedOrders || []
    });

});

// ==========================================
// RECYCLE BIN - RESTORE
// ==========================================

app.post("/api/recycle-bin/orders/:id/restore", (req, res) => {

    const { id } = req.params;
    const database = readDatabase();
    const deletedIndex = (database.deletedOrders || []).findIndex(item => item.id === id);

    if (deletedIndex === -1) {
        return res.status(404).json({
            success: false,
            message: "Order-ka recycle bin kuma jirto."
        });
    }

    const [restoredOrder] = database.deletedOrders.splice(deletedIndex, 1);
    delete restoredOrder.deletedAt;
    delete restoredOrder.deletedBy;

    database.orders.push(restoredOrder);
    saveDatabase(database);

    res.json({
        success: true,
        message: "Order-ka waa la soo celiyay.",
        data: restoredOrder
    });

});


// ==========================================
// ORDERS - ADD
// ==========================================

app.post("/api/orders", (req, res) => {

    const {
        customerName,
        phone,
        product,
        itemName,
        quantity,
        origin,
        country,
        recipientName,
        recipientPhone,
        recipientAddress,
        deliveryFee,
        totalAmount,
        amount,
        status
    } = req.body;

    const resolvedItem = itemName || product || "";
    const resolvedCountry = country || origin || "Somalia";
    const resolvedFee = Number(deliveryFee || amount || 0);
    const resolvedTotal = Number(totalAmount || amount || resolvedFee || 0);

    if (
        !customerName ||
        !phone ||
        !resolvedItem ||
        !recipientName ||
        !resolvedCountry
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Customer, phone, alaabta, qofka loo dalbayo iyo dalka waa muhiim."

        });

    }

    const order = {

        id: generateId("ORD"),

        customerName,

        phone,

        product: resolvedItem,

        itemName: resolvedItem,

        quantity: Number(quantity || 1),

        origin: resolvedCountry,

        country: resolvedCountry,

        recipientName,

        recipientPhone: recipientPhone || phone,

        recipientAddress: recipientAddress || "",

        deliveryFee: resolvedFee,

        totalAmount: resolvedTotal,

        amount: resolvedTotal,

        status:
            status || "Pending",

        createdAt:
            currentDate()

    };


    addRecord(
        "orders",
        order
    );


    res.status(201).json({

        success: true,

        message:
            "Order-ka waa la kaydiyay.",

        data: order

    });

});


// ==========================================
// PAYMENTS - GET
// ==========================================

app.get("/api/payments", (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        data: database.payments

    });

});


// ==========================================
// PAYMENTS - ADD
// ==========================================

app.post("/api/payments", (req, res) => {

    const {
        customerName,
        amount,
        method,
        description,
        reference
    } = req.body;


    if (!customerName || !amount) {

        return res.status(400).json({

            success: false,

            message:
                "Customer iyo lacagta waa muhiim."

        });

    }


    const payment = {

        id: generateId("PAY"),

        customerName,

        amount:
            Number(amount),

        method:
            method || "Cash",

        description:
            description || "",

        reference:
            reference || "",

        date:
            currentDate()

    };


    addRecord(
        "payments",
        payment
    );


    res.status(201).json({

        success: true,

        message:
            "Payment-ka waa la kaydiyay.",

        data: payment

    });

});

// ==========================================
// PAYMENTS - UPDATE
// ==========================================

app.put("/api/payments/:id", (req, res) => {

    const { id } = req.params;
    const database = readDatabase();
    const index = database.payments.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Payment-ka lama helin."
        });
    }

    database.payments[index] = {
        ...database.payments[index],
        ...req.body,
        amount: Number(req.body.amount ?? database.payments[index].amount ?? 0),
        method: req.body.method || database.payments[index].method,
        customerName: req.body.customerName || database.payments[index].customerName,
        description: req.body.description || database.payments[index].description,
        reference: req.body.reference || database.payments[index].reference,
        date: req.body.date || database.payments[index].date
    };

    saveDatabase(database);

    res.json({
        success: true,
        message: "Payment-ka waa la cusbooneysiiyay.",
        data: database.payments[index]
    });

});

// ==========================================
// PAYMENTS - DELETE
// ==========================================

app.delete("/api/payments/:id", (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.payments.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Payment-ka lama helin."
        });
    }

    const [removed] = database.payments.splice(index, 1);
    saveDatabase(database);

    res.json({
        success: true,
        message: "Payment-ka waa la tirtiray.",
        data: removed
    });
});


// ==========================================
// EXPENSES - GET
// ==========================================

app.get("/api/expenses", (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        data: database.expenses

    });

});


// ==========================================
// EXPENSES - ADD
// ==========================================

app.post("/api/expenses", (req, res) => {

    const {
        title,
        amount,
        category
    } = req.body;


    if (!title || !amount) {

        return res.status(400).json({

            success: false,

            message:
                "Expense title iyo amount waa muhiim."

        });

    }


    const expense = {

        id: generateId("EXP"),

        title,

        amount:
            Number(amount),

        category:
            category || "Other",

        date:
            currentDate()

    };


    addRecord(
        "expenses",
        expense
    );


    res.status(201).json({

        success: true,

        message:
            "Expense-ka waa la kaydiyay.",

        data: expense

    });

});

// ==========================================
// REPORTS - GET
// ==========================================

app.get("/api/reports", requireAuth, (req, res) => {
    const database = readDatabase();
    res.json({
        success: true,
        data: database.reports || []
    });
});

// ==========================================
// REPORTS - ADD
// ==========================================

app.post("/api/reports", requireAuth, (req, res) => {
    const { title, category, summary, status } = req.body;

    if (!title) {
        return res.status(400).json({
            success: false,
            message: "Report title waa muhiim."
        });
    }

    const report = {
        id: generateId("RPT"),
        title: title.trim(),
        category: category || "General",
        summary: summary || "",
        status: status || "Draft",
        createdAt: currentDate()
    };

    addRecord("reports", report);

    res.status(201).json({
        success: true,
        message: "Report-ka waa la kaydiyay.",
        data: report
    });
});

// ==========================================
// REPORTS - UPDATE
// ==========================================

app.put("/api/reports/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.reports.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Report-ka lama helin."
        });
    }

    database.reports[index] = {
        ...database.reports[index],
        ...req.body,
        title: req.body.title ? req.body.title.trim() : database.reports[index].title,
        category: req.body.category || database.reports[index].category,
        summary: req.body.summary !== undefined ? req.body.summary : database.reports[index].summary,
        status: req.body.status || database.reports[index].status
    };

    saveDatabase(database);

    res.json({
        success: true,
        message: "Report-ka waa la cusbooneysiiyay.",
        data: database.reports[index]
    });
});

// ==========================================
// REPORTS - DELETE
// ==========================================

app.delete("/api/reports/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.reports.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Report-ka lama helin."
        });
    }

    const [removed] = database.reports.splice(index, 1);
    saveDatabase(database);

    res.json({
        success: true,
        message: "Report-ka waa la tirtiray.",
        data: removed
    });
});


// ==========================================
// MONTHLY BILLS - GET
// ==========================================

app.get("/api/monthly-bills", requireAuth, (req, res) => {
    const database = readDatabase();
    res.json({
        success: true,
        data: database.monthlyBills || []
    });
});

// ==========================================
// MONTHLY BILLS - ADD
// ==========================================

app.post("/api/monthly-bills", requireAuth, (req, res) => {
    const { title, amount, dueDate, status, note } = req.body;

    if (!title || !amount) {
        return res.status(400).json({
            success: false,
            message: "Title iyo lacagta waa muhiim."
        });
    }

    const bill = {
        id: generateId("BILL"),
        title: title.trim(),
        amount: Number(amount),
        dueDate: dueDate || new Date().toISOString().slice(0, 10),
        status: status || "Unpaid",
        note: note || "Monthly company bill",
        createdAt: currentDate()
    };

    addRecord("monthlyBills", bill);

    res.status(201).json({
        success: true,
        message: "Monthly bill-ka waa la kaydiyay.",
        data: bill
    });
});

// ==========================================
// MONTHLY BILLS - UPDATE
// ==========================================

app.put("/api/monthly-bills/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.monthlyBills.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Monthly bill-ka lama helin."
        });
    }

    database.monthlyBills[index] = {
        ...database.monthlyBills[index],
        ...req.body,
        amount: req.body.amount !== undefined ? Number(req.body.amount) : database.monthlyBills[index].amount,
        title: req.body.title ? req.body.title.trim() : database.monthlyBills[index].title,
        dueDate: req.body.dueDate || database.monthlyBills[index].dueDate,
        status: req.body.status || database.monthlyBills[index].status,
        note: req.body.note !== undefined ? req.body.note : database.monthlyBills[index].note
    };

    saveDatabase(database);

    res.json({
        success: true,
        message: "Monthly bill-ka waa la cusbooneysiiyay.",
        data: database.monthlyBills[index]
    });
});

// ==========================================
// MONTHLY BILLS - DELETE
// ==========================================

app.delete("/api/monthly-bills/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.monthlyBills.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Monthly bill-ka lama helin."
        });
    }

    const [removed] = database.monthlyBills.splice(index, 1);
    saveDatabase(database);

    res.json({
        success: true,
        message: "Monthly bill-ka waa la tirtiray.",
        data: removed
    });
});

// ==========================================
// DELIVERIES - GET
// ==========================================

app.get("/api/deliveries", (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        data: database.deliveries

    });

});


// ==========================================
// DELIVERIES - ADD
// ==========================================

app.post("/api/deliveries", (req, res) => {

    const {
        orderId,
        customerName,
        phone,
        address,
        status,
        country,
        item
    } = req.body;


    if (
        !customerName ||
        !phone ||
        !address
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Customer, phone iyo address waa muhiim."

        });

    }


    const delivery = {

        id: generateId("DEL"),

        orderId:
            orderId || "",

        customerName,

        phone,

        address,

        country: country || "Somalia",

        item: item || "General",

        status:
            status || "Pending",

        createdAt:
            currentDate()

    };


    addRecord(
        "deliveries",
        delivery
    );


    res.status(201).json({

        success: true,

        message:
            "Delivery-ga waa la kaydiyay.",

        data: delivery

    });

});

// ==========================================
// DELIVERIES - UPDATE
// ==========================================

app.put("/api/deliveries/:id", (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.deliveries.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Delivery-ga lama helin."
        });
    }

    database.deliveries[index] = {
        ...database.deliveries[index],
        ...req.body,
        country: req.body.country || database.deliveries[index].country,
        item: req.body.item || database.deliveries[index].item,
        customerName: req.body.customerName || database.deliveries[index].customerName,
        phone: req.body.phone || database.deliveries[index].phone,
        address: req.body.address || database.deliveries[index].address,
        status: req.body.status || database.deliveries[index].status
    };

    saveDatabase(database);

    res.json({
        success: true,
        message: "Delivery-ga waa la cusbooneysiiyay.",
        data: database.deliveries[index]
    });
});

// ==========================================
// DELIVERIES - DELETE
// ==========================================

app.delete("/api/deliveries/:id", (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.deliveries.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Delivery-ga lama helin."
        });
    }

    const [removed] = database.deliveries.splice(index, 1);
    saveDatabase(database);

    res.json({
        success: true,
        message: "Delivery-ga waa la tirtiray.",
        data: removed
    });
});


// ==========================================
// SHIPMENTS - GET
// ==========================================

app.get("/api/shipments", requireAuth, (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        data: database.shipments

    });

});


// ==========================================
// SHIPMENTS - ADD
// ==========================================

app.post("/api/shipments", requireAuth, (req, res) => {

    const {
        trackingNumber,
        origin,
        supplier,
        product,
        status
    } = req.body;


    if (
        !trackingNumber ||
        !product
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Tracking number iyo product waa muhiim."

        });

    }


    const shipment = {

        id: generateId("SHP"),

        trackingNumber,

        origin:
            origin || "China",

        supplier:
            supplier || "",

        product,

        status:
            status || "In Transit",

        createdAt:
            currentDate()

    };


    addRecord(
        "shipments",
        shipment
    );


    res.status(201).json({

        success: true,

        message:
            "Shipment-ka waa la kaydiyay.",

        data: shipment

    });

});

// ==========================================
// SHIPMENTS - UPDATE
// ==========================================

app.put("/api/shipments/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.shipments.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Shipment-ka lama helin."
        });
    }

    database.shipments[index] = {
        ...database.shipments[index],
        ...req.body,
        trackingNumber: req.body.trackingNumber || database.shipments[index].trackingNumber,
        origin: req.body.origin || database.shipments[index].origin,
        supplier: req.body.supplier || database.shipments[index].supplier,
        product: req.body.product || database.shipments[index].product,
        status: req.body.status || database.shipments[index].status
    };

    saveDatabase(database);

    res.json({
        success: true,
        message: "Shipment-ka waa la cusbooneysiiyay.",
        data: database.shipments[index]
    });
});

// ==========================================
// SHIPMENTS - DELETE
// ==========================================

app.delete("/api/shipments/:id", requireAuth, (req, res) => {
    const { id } = req.params;
    const database = readDatabase();
    const index = database.shipments.findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "Shipment-ka lama helin."
        });
    }

    const [removed] = database.shipments.splice(index, 1);
    saveDatabase(database);

    res.json({
        success: true,
        message: "Shipment-ka waa la tirtiray.",
        data: removed
    });
});


// ==========================================
// SETTINGS - GET
// ==========================================

app.get("/api/settings", (req, res) => {

    const database =
        readDatabase();

    const defaults = {
        companyName: "Maan Transmitter & Deliver",
        country: "Somalia",
        currency: "USD",
        phone: "",
        companyPhone: "",
        email: "",
        businessAddress: "",
        merchantAddress: "",
        businessDetails: "",
        website: "",
        edahabNumber: "613582084",
        edahabAltNumber: "62 35820842",
        paymentTemplate: "Please send payment confirmation after transfer.",
        logo: "",
        cashierImage: "",
        menuItems: {
            dashboard: "Dashboard",
            orders: "Orders",
            recycleBin: "Recycle Bin",
            customers: "Customers",
            deliveries: "Deliveries",
            shipments: "Shipments",
            payments: "Payments",
            reports: "Reports",
            monthly: "Monthly"
        }
    };

    database.settings = {
        ...defaults,
        ...database.settings,
        menuItems: {
            ...defaults.menuItems,
            ...(database.settings.menuItems || {})
        }
    };

    saveDatabase(database);

    res.json({

        success: true,

        data:
            database.settings

    });

});

app.get("/api/admin/profile", requireAuth, (req, res) => {
    const database = readDatabase();
    const user = database.users.find(item => item.id === req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User-ka lama helin."
        });
    }

    return res.json({
        success: true,
        data: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            role: user.role,
            avatar: user.avatar || ""
        }
    });
});

app.put("/api/admin/profile", requireAuth, (req, res) => {
    const { name, email, phone, avatar } = req.body;

    if (!name || !email || !phone) {
        return res.status(400).json({
            success: false,
            message: "Magaca, email-ka, iyo lambarka telefoonka waa muhiim."
        });
    }

    const database = readDatabase();
    const userIndex = database.users.findIndex(item => item.id === req.user.id);

    if (userIndex === -1) {
        return res.status(404).json({
            success: false,
            message: "User-ka lama helin."
        });
    }

    const existingEmail = database.users.find(item => item.email.toLowerCase() === email.toLowerCase() && item.id !== req.user.id);
    if (existingEmail) {
        return res.status(409).json({
            success: false,
            message: "Email-kan horeyba waa la isticmaalay."
        });
    }

    database.users[userIndex].name = name.trim();
    database.users[userIndex].email = email.trim().toLowerCase();
    database.users[userIndex].phone = String(phone).trim();
    database.users[userIndex].avatar = avatar || "";
    saveDatabase(database);

    return res.json({
        success: true,
        message: "Profile-ka waa la badalay.",
        data: {
            id: database.users[userIndex].id,
            name: database.users[userIndex].name,
            email: database.users[userIndex].email,
            phone: database.users[userIndex].phone || "",
            role: database.users[userIndex].role,
            avatar: database.users[userIndex].avatar || ""
        }
    });
});

app.put("/api/admin/password", requireAuth, async (req, res) => {
    const { email, phone, currentPassword, newPassword } = req.body;

    if (!email || !phone || !currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "Email-ka, lambarka telefoonka, password-ka hadda jira, iyo kan cusub waa in la buuxiyaa."
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: "Password-ka cusub waa inuu ahaado 6 xaraf ama ka badan."
        });
    }

    const database = readDatabase();
    const user = database.users.find(item => item.id === req.user.id);

    if (!user) {
        return res.status(404).json({
            success: false,
            message: "User-ka lama helin."
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const duplicateEmail = database.users.find(item => item.email.toLowerCase() === normalizedEmail && item.id !== req.user.id);
    if (duplicateEmail) {
        return res.status(409).json({
            success: false,
            message: "Email-kan horeyba waa la isticmaalay."
        });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
        return res.status(401).json({
            success: false,
            message: "Password-ka hadda jira waa khalad."
        });
    }

    user.email = normalizedEmail;
    user.phone = String(phone).trim();
    user.password = await bcrypt.hash(newPassword, 12);
    saveDatabase(database);

    return res.json({
        success: true,
        message: "Email-ka, lambarka telefoonka, iyo password-ka waa la badalay.",
        data: {
            email: user.email,
            phone: user.phone
        }
    });
});


// ==========================================
// SETTINGS - UPDATE
// ==========================================

app.put("/api/settings", (req, res) => {

    const database =
        readDatabase();

    const defaults = {
        companyName: "Maan Transmitter & Deliver",
        country: "Somalia",
        currency: "USD",
        phone: "",
        companyPhone: "",
        email: "",
        businessAddress: "",
        merchantAddress: "",
        businessDetails: "",
        website: "",
        edahabNumber: "613582084",
        edahabAltNumber: "62 35820842",
        paymentTemplate: "Please send payment confirmation after transfer.",
        logo: "",
        cashierImage: "",
        menuItems: {
            dashboard: "Dashboard",
            orders: "Orders",
            recycleBin: "Recycle Bin",
            customers: "Customers",
            deliveries: "Deliveries",
            shipments: "Shipments",
            payments: "Payments",
            reports: "Reports",
            monthly: "Monthly"
        }
    };

    const mergeMenuItems = {
        ...defaults.menuItems,
        ...(database.settings.menuItems || {}),
        ...(req.body.menuItems || {})
    };

    database.settings = {

        ...defaults,
        ...database.settings,
        ...req.body,
        menuItems: mergeMenuItems

    };


    saveDatabase(database);


    res.json({

        success: true,

        message:
            "Settings-ka waa la cusbooneysiiyay.",

        data:
            database.settings

    });

});


// ==========================================
// DELETE FALLBACK FOR COLLECTION ROUTES
// ==========================================

const collectionAliases = {
    customer: "customers",
    customers: "customers",
    order: "orders",
    orders: "orders",
    payment: "payments",
    payments: "payments",
    delivery: "deliveries",
    deliveries: "deliveries",
    shipment: "shipments",
    shipments: "shipments",
    report: "reports",
    reports: "reports",
    "monthly-bill": "monthly-bills",
    "monthly-bills": "monthly-bills"
};

app.delete("/api/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    const normalizedCollection = collectionAliases[collection] || collection;

    const collectionMap = {
        customers: "customers",
        orders: "orders",
        payments: "payments",
        deliveries: "deliveries",
        shipments: "shipments",
        reports: "reports",
        "monthly-bills": "monthlyBills"
    };

    const database = readDatabase();
    const targetKey = collectionMap[normalizedCollection];

    if (!targetKey || !database[targetKey] || !Array.isArray(database[targetKey])) {
        return res.status(404).json({
            success: false,
            message: "Bogga ama API-ga lama helin."
        });
    }

    const index = database[targetKey].findIndex(item => item.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: `${normalizedCollection === "customers" ? "Customer" : normalizedCollection === "orders" ? "Order" : normalizedCollection === "payments" ? "Payment" : normalizedCollection === "deliveries" ? "Delivery" : normalizedCollection === "shipments" ? "Shipment" : normalizedCollection === "reports" ? "Report" : "Monthly bill"}-ka lama helin.`
        });
    }

    const [removed] = database[targetKey].splice(index, 1);

    if (normalizedCollection === "orders") {
        const recycleEntry = {
            ...removed,
            deletedAt: currentDate(),
            deletedBy: "admin"
        };
        database.deletedOrders = database.deletedOrders || [];
        database.deletedOrders.push(recycleEntry);
    }

    saveDatabase(database);

    res.json({
        success: true,
        message: normalizedCollection === "orders"
            ? "Order-ka ayaa loo raray recycle bin."
            : `${normalizedCollection === "customers" ? "Customer" : normalizedCollection === "payments" ? "Payment" : normalizedCollection === "deliveries" ? "Delivery" : normalizedCollection === "shipments" ? "Shipment" : normalizedCollection === "reports" ? "Report" : "Monthly bill"}-ka waa la tirtiray.`,
        data: removed
    });
});

// ==========================================
// 404
// ==========================================

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message:
            "Bogga ama API-ga lama helin."

    });

});
// ==========================================
// START SERVER
// ==========================================
// ==========================================
// START SERVER
// ==========================================

async function startServer() {

    try {

        createDatabase();

        await createAdmin();

        closeCompletedMonths();
        monthlyClosingScheduler();
        ensureDailyBackup();
        dailyBackupScheduler();

        app.listen(PORT, () => {

            console.log("");

            console.log("==========================================");

            console.log(
                " MAAN TRANSMITTER & DELIVER"
            );

            console.log("==========================================");

            console.log(
                `Server-ku wuxuu ka shaqeynayaa: http://localhost:${PORT}`
            );

            console.log(
                "Database-ka waa diyaar."
            );

            console.log("==========================================");

            console.log("");

        });

    } catch (error) {

        console.error(
            "Server-ka wuxuu leeyahay cilad:",
            error
        );

    }

}

if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    closeCompletedMonths
};