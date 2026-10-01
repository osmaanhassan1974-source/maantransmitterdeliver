// ==========================================
// MAAN TRANSMITTER & DELIVER
// SERVER.JS - DATABASE CONNECTION
// ==========================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");

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

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));


// ==========================================
// FRONTEND
// ==========================================

app.use(express.static(__dirname));


// ==========================================
// CREATE DATABASE
// ==========================================
// ==========================================
// LOGIN API
// ==========================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message: "Email iyo password waa muhiim."

            });

        }

        const result = await login(
            email,
            password
        );

        if (!result.success) {

            return res.status(401).json(result);

        }

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


// ==========================================
// DATABASE TEST
// ==========================================

app.get("/api/database", (req, res) => {

    const database =
        readDatabase();

    res.json({

        success: true,

        data: database

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
        email: "",
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
    user.password = await bcrypt.hash(newPassword, 10);
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
        email: "",
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

startServer();