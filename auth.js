// ==========================================
// MAAN TRANSMITTER & DELIVER
// AUTH.JS
// ==========================================

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
    readDatabase,
    addRecord,
    generateId,
    currentDate
} = require("./database");


// ==========================================
// SECRET KEY
// ==========================================

function getJwtSecret() {
    if (process.env.JWT_SECRET) {
        if (process.env.JWT_SECRET.length < 32) {
            throw new Error("JWT_SECRET must be at least 32 characters long.");
        }
        return process.env.JWT_SECRET;
    }
    if (process.env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET must be configured in production.");
    }

    const secretFile = path.join(__dirname, "data", ".jwt-secret");
    try {
        const secret = fs.readFileSync(secretFile, "utf8").trim();
        if (secret.length < 32) throw new Error("The local JWT secret is invalid.");
        return secret;
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    fs.mkdirSync(path.dirname(secretFile), { recursive: true });
    const secret = crypto.randomBytes(32).toString("hex");
    try {
        fs.writeFileSync(secretFile, secret, { encoding: "utf8", flag: "wx", mode: 0o600 });
        return secret;
    } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const existingSecret = fs.readFileSync(secretFile, "utf8").trim();
        if (existingSecret.length < 32) throw new Error("The local JWT secret is invalid.");
        return existingSecret;
    }
}

const JWT_SECRET = getJwtSecret();


// ==========================================
// CREATE ADMIN
// ==========================================

async function createAdmin() {

    const database = readDatabase();

    const existingAdmin =
        database.users.find(
            user => user.email === "admin@maan.com"
        );

    if (existingAdmin) {

        return existingAdmin;

    }


    const password = process.env.ADMIN_INITIAL_PASSWORD;
    if (!password || password.length < 12) {
        throw new Error("Set ADMIN_INITIAL_PASSWORD to at least 12 characters before creating the first admin account.");
    }

    const hashedPassword =
        await bcrypt.hash(password, 12);


    const admin = {

        id: generateId("USR"),

        name: "Admin",

        email: "admin@maan.com",

        phone: "",

        password: hashedPassword,

        role: "admin",

        avatar: "",

        createdAt:
            currentDate()

    };


    addRecord(
        "users",
        admin
    );


    console.log(
        "Admin user ayaa database-ka lagu daray."
    );


    return admin;

}


// ==========================================
// LOGIN
// ==========================================

async function login(
    identifier,
    password
) {

    const database =
        readDatabase();


    const user =
        database.users.find(
            item =>
                item.email.toLowerCase() === identifier.toLowerCase()
                || (item.username && item.username.toLowerCase() === identifier.toLowerCase())
        );


    if (!user) {

        return {

            success: false,

            message:
                "Email/username ama password-ka waa khalad."

        };

    }


    const passwordCorrect =
        await bcrypt.compare(
            password,
            user.password
        );


    if (!passwordCorrect) {

        return {

            success: false,

            message:
                "Email/username ama password-ka waa khalad."

        };

    }


    const token =
        jwt.sign(

            {
                id: user.id,

                email: user.email,

                role: user.role

            },

            JWT_SECRET,

            {
                expiresIn: "7d"
            }

        );


    return {

        success: true,

        message:
            "Si guul leh ayaad u gashay.",

        token,

        user: {

            id: user.id,

            name: user.name,
            email: user.email,
            username: user.username || "",
            phone: user.phone || "",

            role: user.role,

            avatar: user.avatar || ""

        }

    };

}


// ==========================================
// VERIFY TOKEN
// ==========================================

function verifyToken(token) {

    try {

        return jwt.verify(
            token,
            JWT_SECRET
        );

    } catch (error) {

        return null;

    }

}


// ==========================================
// AUTH MIDDLEWARE
// ==========================================

function requireAuth(
    req,
    res,
    next
) {

    const authorization =
        req.headers.authorization;


    if (!authorization) {

        return res.status(401).json({

            success: false,

            message:
                "Fadlan marka hore login samee."

        });

    }


    const token =
        authorization.replace(
            "Bearer ",
            ""
        );


    const user =
        verifyToken(token);


    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                "Login-ka wuu dhacay ama token-ku waa khalad."

        });

    }


    req.user = user;

    next();

}


// ==========================================
// EXPORT
// ==========================================

module.exports = {

    createAdmin,

    login,

    verifyToken,

    requireAuth

};