// ==========================================
// MAAN TRANSMITTER & DELIVER
// AUTH.JS
// ==========================================

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
    readDatabase,
    addRecord,
    generateId,
    currentDate
} = require("./database");


// ==========================================
// SECRET KEY
// ==========================================

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "MAAN_TRANSMITTER_SECRET_2026";


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


    const password =
        "123456";

    const hashedPassword =
        await bcrypt.hash(password, 10);


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
    email,
    password
) {

    const database =
        readDatabase();


    const user =
        database.users.find(
            item =>
                item.email.toLowerCase()
                === email.toLowerCase()
        );


    if (!user) {

        return {

            success: false,

            message:
                "Email-ka lama helin."

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
                "Password-ka waa khalad."

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