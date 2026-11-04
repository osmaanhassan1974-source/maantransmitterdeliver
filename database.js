const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataFolder = path.join(__dirname, "data");
const databaseFile = path.join(dataFolder, "database.json");
let requestDatabase = null;
let requestDatabaseRevision = null;
let requestDatabaseDirty = false;

const defaultDatabase = {
    users: [],
    customers: [],
    orders: [],
    deletedOrders: [],
    shipments: [],
    deliveries: [],
    payments: [],
    expenses: [],
    income: [],
    reports: [],
    monthlyBills: [],
    monthlyClosings: [],
    settings: {
        companyName: "Maan Transmitter & Deliver",
        country: "Somalia",
        currency: "USD",
        phone: "",
        email: "",
        website: "",
        edahabNumber: "613582084",
        edahabAltNumber: "62 35820842",
        paymentTemplate: "Please send payment confirmation after transfer.",
        logo: "",
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
    }
};

function createDatabase() {

    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, {
            recursive: true
        });
    }

    if (!fs.existsSync(databaseFile)) {
        fs.writeFileSync(
            databaseFile,
            JSON.stringify(defaultDatabase, null, 2)
        );
    }
}

function readDatabase() {
    if (requestDatabase) return requestDatabase;

    createDatabase();

    const data = fs.readFileSync(
        databaseFile,
        "utf8"
    );

    return JSON.parse(data);
}

function saveDatabase(data) {
    if (requestDatabase) {
        requestDatabase = data;
        requestDatabaseDirty = true;
        return;
    }

    createDatabase();

    const temporaryFile = `${databaseFile}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
        fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), { flag: "wx" });
        fs.renameSync(temporaryFile, databaseFile);
    } catch (error) {
        try {
            if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
        } catch (cleanupError) {
            console.error("Could not remove incomplete database file:", cleanupError);
        }
        throw error;
    }
}

function setRequestDatabase(data, revision) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new TypeError("Remote database state must be an object.");
    }
    requestDatabase = data;
    requestDatabaseRevision = revision;
    requestDatabaseDirty = false;
}

function getRequestDatabaseState() {
    return {
        data: requestDatabase,
        revision: requestDatabaseRevision,
        dirty: requestDatabaseDirty
    };
}

function clearRequestDatabase() {
    requestDatabase = null;
    requestDatabaseRevision = null;
    requestDatabaseDirty = false;
}

function addRecord(collection, record) {

    const database = readDatabase();

    if (!database[collection]) {
        database[collection] = [];
    }

    database[collection].push(record);

    saveDatabase(database);

    return record;
}

function findById(collection, id) {

    const database = readDatabase();

    if (!database[collection]) {
        return null;
    }

    return database[collection].find(
        item => item.id === id
    );
}

function deleteById(collection, id) {

    const database = readDatabase();

    if (!database[collection]) {
        return false;
    }

    const oldLength =
        database[collection].length;

    database[collection] =
        database[collection].filter(
            item => item.id !== id
        );

    saveDatabase(database);

    return database[collection].length < oldLength;
}

function updateById(
    collection,
    id,
    updates
) {

    const database = readDatabase();

    if (!database[collection]) {
        return null;
    }

    const index =
        database[collection].findIndex(
            item => item.id === id
        );

    if (index === -1) {
        return null;
    }

    database[collection][index] = {
        ...database[collection][index],
        ...updates
    };

    saveDatabase(database);

    return database[collection][index];
}

function generateId(prefix) {

    const random =
        Math.floor(
            100000 +
            Math.random() * 900000
        );

    return `${prefix}-${random}`;
}

function currentDate() {

    return new Date().toISOString();

}


// IMPORTANT
// Functions-ka server.js u baahan yahay
// halkaan ayaan export-gareyneynaa.

module.exports = {
    createDatabase,
    readDatabase,
    saveDatabase,
    addRecord,
    findById,
    deleteById,
    updateById,
    generateId,
    currentDate,
    setRequestDatabase,
    getRequestDatabaseState,
    clearRequestDatabase
};