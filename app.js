// ==========================================
// MAAN TRANSMITTER & DELIVER
// MAIN JAVASCRIPT
// REAL DATABASE LOGIN
// ==========================================


// ==========================================
// ELEMENTS
// ==========================================

const loginPage =
    document.getElementById("loginPage");

const dashboardPage =
    document.getElementById("dashboardPage");

const loginForm =
    document.getElementById("loginForm");

const logoutBtn =
    document.getElementById("logoutBtn");

const menuLinks =
    document.querySelectorAll(".menu-link");

const pages =
    document.querySelectorAll(".page");

const pageTitle =
    document.getElementById("pageTitle");

const pageSubtitle =
    document.getElementById("pageSubtitle");

const mobileMenuBtn =
    document.getElementById("mobileMenuBtn");

const sidebar =
    document.querySelector(".sidebar");

const authStorageKeys = new Set(["maanToken", "maanUser", "maanLoggedIn"]);
const localStorage = new Proxy(window.localStorage, {
    get(target, property) {
        if (property === "getItem") {
            return key => {
                if (!authStorageKeys.has(String(key))) return window.localStorage.getItem(key);
                const storage = window.localStorage.getItem("maanRememberMe") === "false"
                    ? window.sessionStorage
                    : window.localStorage;
                return storage.getItem(key);
            };
        }
        if (property === "setItem") {
            return (key, value) => {
                if (!authStorageKeys.has(String(key))) return window.localStorage.setItem(key, value);
                const storage = window.localStorage.getItem("maanRememberMe") === "false"
                    ? window.sessionStorage
                    : window.localStorage;
                const otherStorage = storage === window.localStorage ? window.sessionStorage : window.localStorage;
                otherStorage.removeItem(key);
                storage.setItem(key, value);
            };
        }
        if (property === "removeItem") {
            return key => {
                window.localStorage.removeItem(key);
                if (authStorageKeys.has(String(key))) window.sessionStorage.removeItem(key);
            };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
    }
});


// ==========================================
// API URL
// ==========================================

const API_URL = "/api";

const defaultMenuItems = {
    dashboard: "Dashboard",
    orders: "Orders",
    recycleBin: "Recycle Bin",
    customers: "Customers",
    deliveries: "Deliveries",
    shipments: "Shipments",
    payments: "Payments",
    reports: "Reports",
    monthly: "Monthly"
};

function applyMenuLabels(menuItems = defaultMenuItems) {
    Object.entries(menuItems).forEach(([pageKey, label]) => {
        const menuLabel = document.querySelector(`.menu-link[data-page="${pageKey}"] span:not(.menu-icon)`);
        if (menuLabel && label && label.trim()) {
            menuLabel.textContent = label.trim();
        }
    });
}

// ==========================================
// LOGIN
// ==========================================

// ==========================================
// LOGIN - DATABASE
// ==========================================

const authStatus = document.getElementById("authStatus");
const rememberMeInput = document.getElementById("rememberMe");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const signupForm = document.getElementById("signupForm");

function setAuthStatus(message, isError = false) {
    if (!authStatus) return;
    authStatus.textContent = message;
    authStatus.classList.toggle("is-error", isError);
}

async function loadPublicLoginBranding() {
    try {
        const response = await fetch(`${API_URL}/public/branding`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) {
            throw new Error(result.message || "Company branding could not be loaded.");
        }

        const companyName = document.getElementById("loginCompanyName");
        if (companyName) companyName.textContent = result.data.companyName.toUpperCase();

        const logoImage = document.getElementById("loginBrandImage");
        const fallbackLogo = document.getElementById("loginBrandSvg");
        if (!logoImage || !fallbackLogo) return;
        logoImage.onerror = () => {
            logoImage.classList.add("hidden");
            logoImage.removeAttribute("src");
            fallbackLogo.classList.remove("hidden");
        };
        if (result.data.logo) {
            logoImage.src = result.data.logo;
            logoImage.classList.remove("hidden");
            fallbackLogo.classList.add("hidden");
        } else {
            logoImage.removeAttribute("src");
            logoImage.classList.add("hidden");
            fallbackLogo.classList.remove("hidden");
        }
    } catch (error) {
        console.error("Login branding error:", error);
    }
}

loadPublicLoginBranding();

function showAuthMode(mode) {
    const isSignup = mode === "signup";
    loginForm.classList.toggle("hidden", isSignup);
    signupForm.classList.toggle("hidden", !isSignup);
    document.getElementById("loginTab").classList.toggle("active", !isSignup);
    document.getElementById("signupTab").classList.toggle("active", isSignup);
    document.getElementById("loginTab").setAttribute("aria-selected", String(!isSignup));
    document.getElementById("signupTab").setAttribute("aria-selected", String(isSignup));
    document.getElementById("authHeading").textContent = isSignup ? "Create your account" : "Sign in to your account";
    document.getElementById("authSubheading").textContent = isSignup
        ? "Ku bilow akoon cusub si aad u isticmaasho adeegga."
        : "Geli faahfaahinta akoonkaaga si aad u sii wadato.";
    setAuthStatus("");
}

document.getElementById("loginTab")?.addEventListener("click", () => showAuthMode("login"));
document.getElementById("signupTab")?.addEventListener("click", () => showAuthMode("signup"));

document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.passwordToggle);
        if (!input) return;
        const reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.textContent = reveal ? "Hide" : "Show";
        button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    });
});

async function establishLoginSession(result) {
    window.localStorage.setItem("maanRememberMe", rememberMeInput?.checked === false ? "false" : "true");
    localStorage.setItem("maanLoggedIn", "true");
    localStorage.setItem("maanToken", result.token);
    localStorage.setItem("maanUser", JSON.stringify(result.user));
    showDashboard();
}

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const identifier = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (!identifier || !password) {
        setAuthStatus("Geli username/email iyo password-kaaga.", true);
        return;
    }

    try {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.classList.add("is-loading");
        setAuthStatus("Waa lagu xaqiijinayaa...");
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            setAuthStatus(result.message || "Login-ku ma suurtagelin.", true);
            return;
        }
        await establishLoginSession(result);
    } catch (error) {
        console.error("Login error:", error);
        setAuthStatus("Server-ka lama xiriiri karo. Hubi inuu shaqaynayo.", true);
    } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.classList.remove("is-loading");
    }
});

signupForm?.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!signupForm.reportValidity()) return;

    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("signupConfirmPassword").value;
    const username = document.getElementById("signupUsername").value.trim();
    if (password !== confirmPassword) {
        setAuthStatus("Labada password isma laha.", true);
        document.getElementById("signupConfirmPassword").focus();
        return;
    }
    if (!/^[a-z0-9._-]{3,30}$/i.test(username)) {
        setAuthStatus("Username-ku ha noqdo 3 ilaa 30 xaraf: English letters, tirooyin, ., _ ama -.", true);
        document.getElementById("signupUsername").focus();
        return;
    }

    const submitButton = document.getElementById("signupSubmitBtn");
    const payload = {
        name: document.getElementById("signupName").value.trim(),
        phone: document.getElementById("signupPhone").value.trim(),
        email: document.getElementById("signupEmail").value.trim(),
        username,
        password
    };
    try {
        submitButton.disabled = true;
        submitButton.classList.add("is-loading");
        setAuthStatus("Akoonka waa la abuurayaa...");
        const response = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            setAuthStatus(result.message || "Akoonka lama samayn karin.", true);
            return;
        }
        signupForm.reset();
        await establishLoginSession(result);
    } catch (error) {
        console.error("Registration error:", error);
        setAuthStatus("Server-ka lama xiriiri karo. Akoonka lama samayn karin.", true);
    } finally {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
    }
});

// ==========================================
// SHOW DASHBOARD
// ==========================================

function showDashboard() {

    loginPage.classList.add(
        "hidden"
    );

    dashboardPage.classList.remove(
        "hidden"
    );

    const directPaymentBtn = document.getElementById("directPaymentBtn");
    const directPaymentModal = document.getElementById("directPaymentModal");
    const directPaymentForm = document.getElementById("directPaymentForm");

    if (directPaymentBtn) {
        directPaymentBtn.addEventListener("click", function () {
            if (directPaymentModal) {
                directPaymentModal.classList.remove("hidden");
            }
        });
    }

    if (directPaymentForm) {
        directPaymentForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const method = document.getElementById("directPaymentMethod").value;
            const amount = Number(document.getElementById("directPaymentAmount").value || 0);
            const reference = document.getElementById("directPaymentReference").value.trim();
            const description = document.getElementById("directPaymentDescription").value.trim();

            if (!amount || amount <= 0) {
                alert("Fadlan geli lacag sax ah.");
                return;
            }

            try {
                const response = await fetch(`${API_URL}/payments`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("maanToken") || ""}`
                    },
                    body: JSON.stringify({
                        customerName: "Direct Payment",
                        amount,
                        method,
                        reference: reference || `Direct-${method}`,
                        description: description || `Paid directly via ${method}`
                    })
                });

                const result = await response.json();
                if (!result.success) {
                    alert(result.message || "Payment-ka lama kaydin.");
                    return;
                }

                alert(`Payment-ka waa la keydiyay. Please send ${formatMoney(amount)} to ${method === "E-Plus" ? "0613582084" : "0613582084"}.`);
                directPaymentForm.reset();
                if (directPaymentModal) directPaymentModal.classList.add("hidden");
                loadPayments();
                loadDashboardStatistics();
                loadAccounting();
            } catch (error) {
                console.error("Direct payment save error:", error);
                alert("Server-ka lama xiriiri karo.");
            }
        });
    }

    const closeDirectPaymentBtn = document.querySelector("[data-close-direct-payment='true']");
    if (closeDirectPaymentBtn) {
        closeDirectPaymentBtn.addEventListener("click", function () {
            if (directPaymentModal) directPaymentModal.classList.add("hidden");
        });
    }


    const savedUser =
        localStorage.getItem(
            "maanUser"
        );


    if (savedUser) {

        try {

            const user =
                JSON.parse(
                    savedUser
                );

            const headerAvatar = document.querySelector(".user-avatar");
            if (headerAvatar) {
                if (user.avatar) {
                    headerAvatar.innerHTML = `<img src="${user.avatar}" alt="Admin avatar">`;
                } else {
                    headerAvatar.textContent = (user.name || "A").charAt(0).toUpperCase();
                }
            }

            document.getElementById(
                "currentUser"
            ).textContent =
                user.name || "Admin";
            const userRoleLabel = document.getElementById("currentUserRole");
            if (userRoleLabel) userRoleLabel.textContent = user.role === "admin" ? "Administrator" : "Staff";


        } catch (error) {

            console.error(
                "User data error:",
                error
            );

        }

    }


    // Dashboard statistics
    loadDashboardStatistics();
    loadCustomers();
    loadOrders();
    loadRecycleBin();
    loadPayments();
    loadDeliveries();
    loadShipments();
    loadMonthlyBill();
    loadAccounting();
    loadReports();
    loadSettings();
}


// ==========================================
// LOGOUT
// ==========================================

logoutBtn.addEventListener(
    "click",
    function () {

        const confirmLogout =
            confirm(
                "Ma hubtaa inaad rabto inaad ka baxdo Dashboard-ka?"
            );


        if (!confirmLogout) {

            return;

        }


        localStorage.removeItem(
            "maanToken"
        );

        localStorage.removeItem(
            "maanUser"
        );


        dashboardPage.classList.add(
            "hidden"
        );

        loginPage.classList.remove(
            "hidden"
        );


        loginForm.reset();

    }
);


// ==========================================
// CHECK LOGIN
// ==========================================

async function checkLogin() {

    const token =
        localStorage.getItem(
            "maanToken"
        );


    const user =
        localStorage.getItem(
            "maanUser"
        );


    if (token && user) {
        try {
            const response = await fetch(`${API_URL}/admin/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.status === 401) {
                localStorage.removeItem("maanLoggedIn");
                localStorage.removeItem("maanToken");
                localStorage.removeItem("maanUser");
                loginPage.classList.remove("hidden");
                dashboardPage.classList.add("hidden");
                return;
            }
            if (!response.ok) {
                throw new Error("Akoonka lama xaqiijin karin.");
            }
            const session = await response.json();
            if (session.success && session.data) {
                localStorage.setItem("maanUser", JSON.stringify(session.data));
            }
            showDashboard();
        } catch (error) {
            console.error("Session verification error:", error);
            loginPage.classList.remove("hidden");
            dashboardPage.classList.add("hidden");
            alert("Server-ka lama xiriiri karo. Hubi inuu shaqaynayo, kadibna bogga dib u cusboonaysii.");
        }

    } else {

        loginPage.classList.remove(
            "hidden"
        );

        dashboardPage.classList.add(
            "hidden"
        );

    }

}


// ==========================================
// PAGE NAVIGATION
// ==========================================

menuLinks.forEach(
    function (link) {

        link.addEventListener(
            "click",
            function (event) {

                event.preventDefault();


                const pageName =
                    this.dataset.page;

                if (pageName === "badalFuran") {
                    event.preventDefault();
                    openBadalFuranSettings();
                    sidebar.classList.remove("show");
                    return;
                }

                if (pageName === "dashboardSettings") {
                    event.preventDefault();
                    openDashboardSettings();
                    sidebar.classList.remove("show");
                    return;
                }

                openPage(
                    pageName
                );


                sidebar.classList.remove(
                    "show"
                );

            }
        );

    }
);


// ==========================================
// OPEN PAGE
// ==========================================

function openPage(pageName) {

    pages.forEach(
        function (page) {

            page.classList.remove(
                "active-page"
            );

        }
    );


    menuLinks.forEach(
        function (link) {

            link.classList.remove(
                "active"
            );

        }
    );


    const selectedPage =
        document.getElementById(
            pageName + "Page"
        );


    if (selectedPage) {

        selectedPage.classList.add(
            "active-page"
        );

    }


    const selectedMenu =
        document.querySelector(
            `.menu-link[data-page="${pageName}"]`
        );


    if (selectedMenu) {

        selectedMenu.classList.add(
            "active"
        );

    }

    if (pageName === "profile") {
        loadSettings();
        loadBackups();
    }


    updatePageTitle(
        pageName
    );

}

document.querySelectorAll("[data-open-page]").forEach(function (button) {
    button.addEventListener("click", function () {
        const pageName = this.dataset.openPage;
        if (pageName) openPage(pageName);
    });
});


// ==========================================
// PAGE TITLES
// ==========================================

function updatePageTitle(
    pageName
) {

    const titles = {

        home: {
            title: "Dashboard",
            subtitle:
                "Ku soo dhawoow Maan Transmitter & Deliver"
        },

        orders: {
            title: "Orders",
            subtitle:
                "Maamul dhammaan dalabaadka."
        },

        recycleBin: {
            title: "Recycle Bin",
            subtitle:
                "Sooceli alaabta la tiray."
        },

        customers: {
            title: "Customers",
            subtitle:
                "Maamul macaamiisha shirkadda."
        },

        deliveries: {
            title: "Deliveries",
            subtitle:
                "Maamul gaarsiinta dalabaadka."
        },

        shipments: {
            title: "Shipments",
            subtitle:
                "Maamul alaabaha China iyo Turkey."
        },

        payments: {
            title: "Payments",
            subtitle:
                "Maamul dhammaan lacag-bixinta."
        },

        accounting: {
            title: "Xisaabaad",
            subtitle:
                "Maamul dakhliga iyo kharashaadka."
        },

        reports: {
            title: "Reports",
            subtitle:
                "Falanqee xogta shirkadda."
        },

        monthly: {
            title: "Monthly",
            subtitle:
                "Arag xogta bil kasta."
        },

        profile: {
            title: "Profile",
            subtitle:
                "Maamul logo, cashier, iyo profile-ka shirkadda."
        },

        settings: {
            title: "Settings",
            subtitle:
                "Maamul settings-ka shirkadda."
        }

    };


    const currentPage =
        titles[pageName];


    if (currentPage) {

        pageTitle.textContent =
            currentPage.title;

        pageSubtitle.textContent =
            currentPage.subtitle;

    }

}


// ==========================================
// MOBILE MENU
// ==========================================

mobileMenuBtn.addEventListener(
    "click",
    function () {

        sidebar.classList.toggle(
            "show"
        );

    }
);


// ==========================================
// QUICK ACTIONS
// ==========================================

const actionButtons =
    document.querySelectorAll(
        ".action-btn, .settings-menu-item"
    );


actionButtons.forEach(
    function (button) {

        button.addEventListener(
            "click",
            function () {

                const action =
                    this.dataset.action;

                const directPage = this.dataset.openPage;

                if (directPage) {
                    openPage(directPage);
                    const settingsDropdown = document.getElementById("settingsMenu")?.parentElement;
                    if (settingsDropdown) {
                        settingsDropdown.classList.remove("open");
                    }
                    return;
                }


                if (action === "order") {

                    openPage(
                        "orders"
                    );

                }


                if (action === "customer") {

                    openPage(
                        "customers"
                    );

                }


                if (action === "payment") {

                    openPage(
                        "payments"
                    );

                }


                if (action === "report") {

                    openPage(
                        "reports"
                    );

                }

            }
        );

    }
);

const quickNewOrderBtn = document.getElementById("quickNewOrderBtn");
const quickNewCustomerBtn = document.getElementById("quickNewCustomerBtn");
const adminSettingsModal = document.getElementById("adminSettingsModal");
const profileModalView = document.getElementById("profileModalView");
const passwordModalView = document.getElementById("passwordModalView");
const closeAdminModal = document.getElementById("closeAdminModal");

function openDashboardSettings() {
    openAdminModal("profile");
    if (accountMenuDropdown) {
        accountMenuDropdown.classList.remove("open");
    }
}

function openBadalFuranSettings() {
    openAdminModal("profile");
    if (accountMenuDropdown) {
        accountMenuDropdown.classList.remove("open");
    }
}

function populatePasswordForm() {
    const savedUser = JSON.parse(localStorage.getItem("maanUser") || "{}");
    const emailPasswordInput = document.getElementById("emailPasswordInput");
    const phonePasswordInput = document.getElementById("phonePasswordInput");
    if (emailPasswordInput) {
        emailPasswordInput.value = savedUser.email || "admin@maan.com";
    }
    if (phonePasswordInput) {
        phonePasswordInput.value = savedUser.phone || "";
    }
}

function openAdminModal(type) {
    if (!adminSettingsModal) return;

    adminSettingsModal.classList.remove("hidden");
    profileModalView?.classList.add("hidden");
    passwordModalView?.classList.add("hidden");

    if (type === "profile") {
        profileModalView?.classList.remove("hidden");
        populateProfileForm();
    }

    if (type === "password") {
        passwordModalView?.classList.remove("hidden");
        populatePasswordForm();
    }
}

function closeAdminModalView() {
    if (!adminSettingsModal) return;
    adminSettingsModal.classList.add("hidden");
    profileModalView?.classList.add("hidden");
    passwordModalView?.classList.add("hidden");
}

function bindDropdown(trigger, dropdown) {
    if (!trigger || !dropdown) return;

    trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        dropdown.classList.toggle("open");
    });

    document.addEventListener("click", function (event) {
        if (!dropdown.contains(event.target)) {
            dropdown.classList.remove("open");
        }
    });
}

const quickControlButtons = document.querySelectorAll(".quick-control-btn");
quickControlButtons.forEach(button => {
    button.addEventListener("click", function () {
        const action = this.dataset.action;
        const openPageName = this.dataset.openPage;

        if (openPageName) {
            openPage(openPageName);
            return;
        }

        if (action === "profile") {
            openAdminModal("profile");
            if (accountMenuDropdown) {
                accountMenuDropdown.classList.remove("open");
            }
            return;
        }

        if (action === "password") {
            openAdminModal("password");
            if (accountMenuDropdown) {
                accountMenuDropdown.classList.remove("open");
            }
            return;
        }
    });
});

const accountMenuTrigger = document.getElementById("accountMenuTrigger");
const accountMenuDropdown = document.getElementById("accountMenuDropdown");

if (accountMenuTrigger && accountMenuDropdown) {
    accountMenuTrigger.addEventListener("click", function (event) {
        event.stopPropagation();
        accountMenuDropdown.classList.toggle("open");
    });

    document.addEventListener("click", function (event) {
        if (!accountMenuDropdown.contains(event.target) && !accountMenuTrigger.contains(event.target)) {
            accountMenuDropdown.classList.remove("open");
        }
    });
}

if (quickNewOrderBtn) {
    quickNewOrderBtn.addEventListener("click", function () {
        openPage("orders");
        if (orderFormBox) orderFormBox.classList.remove("hidden");
    });
}

if (quickNewCustomerBtn) {
    quickNewCustomerBtn.addEventListener("click", function () {
        openPage("customers");
        if (customerFormBox) customerFormBox.classList.remove("hidden");
    });
}

closeAdminModal?.addEventListener("click", closeAdminModalView);
adminSettingsModal?.addEventListener("click", function (event) {
    if (event.target === adminSettingsModal) {
        closeAdminModalView();
    }
});


// ==========================================
// LOAD DASHBOARD STATISTICS
// ==========================================

async function loadDashboardStatistics() {

    const token =
        localStorage.getItem(
            "maanToken"
        );


    if (!token) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/dashboard`,
                {

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            );


        const result =
            await response.json();


        if (!result.success) {

            return;

        }


        const data =
            result.data;


        document.getElementById(
            "totalOrders"
        ).textContent =
            data.orders;


        document.getElementById(
            "totalCustomers"
        ).textContent =
            data.customers;


        document.getElementById(
            "totalRevenue"
        ).textContent =
            `$${Number(
                data.payments || 0
            ).toLocaleString()}`;


        document.getElementById(
            "totalDeliveries"
        ).textContent =
            data.deliveries;

        const todayOrders = document.getElementById("todayOrdersCount");
        const thisMonthOrders = document.getElementById("thisMonthOrdersCount");
        const thisMonthRevenue = document.getElementById("thisMonthRevenue");

        if (todayOrders || thisMonthOrders || thisMonthRevenue) {
            const orders = (window.allOrders || []).filter(Boolean);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const todayCount = orders.filter(function (order) {
                if (!order.createdAt) return false;
                const date = new Date(order.createdAt);
                return date >= today;
            }).length;

            const monthCount = orders.filter(function (order) {
                if (!order.createdAt) return false;
                const date = new Date(order.createdAt);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            }).length;

            const monthRevenue = orders.filter(function (order) {
                if (!order.createdAt) return false;
                const date = new Date(order.createdAt);
                return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
            }).reduce(function (sum, order) {
                return sum + Number(order.totalAmount || order.amount || 0);
            }, 0);

            if (todayOrders) todayOrders.textContent = todayCount;
            if (thisMonthOrders) thisMonthOrders.textContent = monthCount;
            if (thisMonthRevenue) thisMonthRevenue.textContent = `$${monthRevenue.toLocaleString()}`;
        }

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }

}


// ==========================================
// START APPLICATION
// ==========================================

checkLogin();

const dashboardClickableTargets = {
    totalOrders: { page: "orders" },
    totalCustomers: { page: "customers" },
    totalRevenue: { page: "payments" },
    totalDeliveries: { page: "deliveries" },
    todayOrdersCount: { page: "orders" },
    thisMonthOrdersCount: { page: "orders" },
    thisMonthRevenue: { page: "payments" }
};

Object.entries(dashboardClickableTargets).forEach(function ([id, config]) {
    const element = document.getElementById(id);
    if (!element) return;

    element.style.cursor = "pointer";
    element.addEventListener("click", function () {
        openPage(config.page);
    });
});

// ==========================================
// ORDERS - DATABASE
// ==========================================

const addOrderBtn =
    document.getElementById("addOrderBtn");

const cancelOrderBtn =
    document.getElementById("cancelOrderBtn");

const orderFormBox =
    document.getElementById("orderFormBox");

const orderForm =
    document.getElementById("orderForm");

const orderEditIdInput =
    document.getElementById("orderEditId");

const closeReceiptBtn =
    document.getElementById("closeReceiptBtn");

const printReceiptBtn =
    document.getElementById("printReceiptBtn");

const orderReceiptModal =
    document.getElementById("orderReceiptModal");

const receiptContent =
    document.getElementById("receiptContent");


// ==========================================
// OPEN ORDER FORM
// ==========================================

if (addOrderBtn) {
    addOrderBtn.addEventListener("click", function () {
        orderFormBox.classList.remove("hidden");
    });
}

if (cancelOrderBtn) {
    cancelOrderBtn.addEventListener("click", function () {
        orderForm.reset();
        if (orderEditIdInput) orderEditIdInput.value = "";
        orderFormBox.classList.add("hidden");
    });
}

function resetOrderForm() {
    orderForm.reset();
    if (orderEditIdInput) orderEditIdInput.value = "";
}

function formatMoney(value) {
    const amount = Number(value || 0);
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function showReceipt(order) {
    if (!orderReceiptModal || !receiptContent) return;

    let companyName = "Maan Transmitter & Deliver";
    let companyMeta = "Somalia Dispatch & Logistics";
    let companyPhone = "";
    let companyEmail = "";
    let companyLogo = "";

    try {
        const token = localStorage.getItem("maanToken");
        if (token) {
            const response = await fetch(`${API_URL}/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await response.json();
            if (result.success && result.data) {
                const settings = result.data;
                companyName = settings.companyName || companyName;
                companyMeta = settings.country ? `${settings.country} Dispatch & Logistics` : companyMeta;
                companyPhone = settings.phone || "";
                companyEmail = settings.email || "";
                companyLogo = settings.logo || "";
            }
        }
    } catch (error) {
        console.error("Receipt branding load error:", error);
    }

    const brandLogoHtml = companyLogo
        ? `<img src="${companyLogo}" class="receipt-logo-image" alt="${companyName}" />`
        : `<div class="receipt-logo">MTD</div>`;

    const contactLine = [companyPhone, companyEmail].filter(Boolean).join(" • ");

    const receiptHtml = `
        <div class="receipt-paper">
            <div class="receipt-brand">
                ${brandLogoHtml}
                <div class="receipt-brand-copy">
                    <h2>${companyName}</h2>
                    <p>${companyMeta}</p>
                    ${contactLine ? `<div class="receipt-contact">${contactLine}</div>` : ""}
                </div>
            </div>

            <div class="receipt-meta">
                <div><strong>Receipt No:</strong> ${order.id}</div>
                <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
            </div>

            <div class="receipt-section">
                <h4>Customer</h4>
                <p>${order.customerName}</p>
                <p>${order.phone}</p>
            </div>

            <div class="receipt-section">
                <h4>Shipment Details</h4>
                <p><strong>Item:</strong> ${order.itemName || order.product}</p>
                <p><strong>Qty:</strong> ${order.quantity || 1}</p>
                <p><strong>Destination:</strong> ${order.country || order.origin || "Somalia"}</p>
            </div>

            <div class="receipt-section">
                <h4>Recipient</h4>
                <p>${order.recipientName}</p>
                <p>${order.recipientPhone || order.phone}</p>
                <p>${order.recipientAddress || "Address not provided"}</p>
            </div>

            <div class="receipt-total">
                <div><span>Delivery Fee</span><strong>${formatMoney(order.deliveryFee || 0)}</strong></div>
                <div><span>Total</span><strong>${formatMoney(order.totalAmount || order.amount || 0)}</strong></div>
                <div><span>Status</span><strong>${order.status}</strong></div>
            </div>
        </div>
    `;

    receiptContent.innerHTML = receiptHtml;
    orderReceiptModal.classList.remove("hidden");
}

if (closeReceiptBtn) {
    closeReceiptBtn.addEventListener("click", function () {
        orderReceiptModal.classList.add("hidden");
    });
}

if (printReceiptBtn) {
    printReceiptBtn.addEventListener("click", function () {
        window.print();
    });
}

if (orderForm) {
    orderForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const payload = {
            customerName: document.getElementById("orderCustomerName").value.trim(),
            phone: document.getElementById("orderPhone").value.trim(),
            itemName: document.getElementById("orderItemName").value.trim(),
            product: document.getElementById("orderItemName").value.trim(),
            quantity: Number(document.getElementById("orderQuantity").value || 1),
            country: document.getElementById("orderCountry").value.trim(),
            origin: document.getElementById("orderCountry").value.trim(),
            recipientName: document.getElementById("orderRecipientName").value.trim(),
            recipientPhone: document.getElementById("orderRecipientPhone").value.trim(),
            recipientAddress: document.getElementById("orderRecipientAddress").value.trim(),
            deliveryFee: Number(document.getElementById("orderDeliveryFee").value || 0),
            totalAmount: Number(document.getElementById("orderTotalAmount").value || 0),
            amount: Number(document.getElementById("orderTotalAmount").value || 0),
            status: document.getElementById("orderStatus").value
        };

        if (!payload.customerName || !payload.phone || !payload.itemName || !payload.recipientName || !payload.country) {
            alert("Fadlan buuxi dhammaan xogaha required-ka ah.");
            return;
        }

        const editingOrderId = orderEditIdInput ? orderEditIdInput.value : "";
        const isEditMode = Boolean(editingOrderId);

        try {
            const response = await fetch(`${API_URL}/orders${isEditMode ? `/${editingOrderId}` : ""}`, {
                method: isEditMode ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("maanToken") || ""}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!result.success) {
                alert(result.message || "Order-ka lama kaydin.");
                return;
            }

            alert(isEditMode ? "Order-ka waa la cusbooneysiiyay." : "Order-ka si guul leh ayaa loo kaydiyay.");
            resetOrderForm();
            orderFormBox.classList.add("hidden");
            loadOrders();
            loadDashboardStatistics();
            if (!isEditMode) showReceipt(result.data);

        } catch (error) {
            console.error("Order save error:", error);
            alert("Server-ka lama xiriiri karo.");
        }
    });
}

async function loadOrders() {
    const token = localStorage.getItem("maanToken");

    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!result.success) {
            return;
        }

        const orders = result.data || [];
        window.allOrders = orders;

        const tableBody = document.getElementById("ordersTableBody");
        const recentOrdersBody = document.getElementById("recentOrders");

        if (tableBody) {
            if (orders.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="10">Wali order lama gelin.</td>
                    </tr>
                `;
            } else {
                tableBody.innerHTML = orders.map(function (order) {
                    const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-";
                    return `
                        <tr>
                            <td>${order.id}</td>
                            <td>${order.customerName}</td>
                            <td>${order.itemName || order.product || "-"}</td>
                            <td>${order.country || order.origin || "-"}</td>
                            <td>${order.recipientName || "-"}</td>
                            <td>${formatMoney(order.deliveryFee || 0)}</td>
                            <td>${formatMoney(order.totalAmount || order.amount || 0)}</td>
                            <td>${order.status || "Pending"}</td>
                            <td>${date}</td>
                            <td>
                                <div class="action-inline">
                                    <button class="small-btn" type="button" data-action="receipt" data-order-id="${order.id}">Receipt</button>
                                    <button class="small-btn" type="button" data-action="edit" data-order-id="${order.id}">Edit</button>
                                    <button class="small-btn danger-btn" type="button" data-action="delete" data-order-id="${order.id}">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join("");

                tableBody.querySelectorAll("button[data-order-id]").forEach(function (button) {
                    button.addEventListener("click", function () {
                        const orderId = this.dataset.orderId;
                        const action = this.dataset.action;
                        const selected = orders.find(function (order) {
                            return order.id === orderId;
                        });

                        if (action === "receipt" && selected) {
                            showReceipt(selected);
                        }

                        if (action === "edit" && selected) {
                            document.getElementById("orderCustomerName").value = selected.customerName || "";
                            document.getElementById("orderPhone").value = selected.phone || "";
                            document.getElementById("orderItemName").value = selected.itemName || selected.product || "";
                            document.getElementById("orderQuantity").value = selected.quantity || 1;
                            document.getElementById("orderCountry").value = selected.country || selected.origin || "";
                            document.getElementById("orderRecipientName").value = selected.recipientName || "";
                            document.getElementById("orderRecipientPhone").value = selected.recipientPhone || "";
                            document.getElementById("orderRecipientAddress").value = selected.recipientAddress || "";
                            document.getElementById("orderDeliveryFee").value = selected.deliveryFee || 0;
                            document.getElementById("orderTotalAmount").value = selected.totalAmount || selected.amount || 0;
                            document.getElementById("orderStatus").value = selected.status || "Pending";
                            if (orderEditIdInput) orderEditIdInput.value = selected.id;
                            orderFormBox.classList.remove("hidden");
                            openPage("orders");
                        }

                        if (action === "delete" && selected) {
                            if (!confirm(`Ma hubtaa inaad rabto inaad tirtirto order ${selected.id}?`)) {
                                return;
                            }

                            fetch(`${API_URL}/orders/${selected.id}`, {
                                method: "DELETE",
                                headers: {
                                    "Authorization": `Bearer ${localStorage.getItem("maanToken") || ""}`
                                }
                            }).then(async function (response) {
                                const result = await response.json();
                                if (!result.success) {
                                    alert(result.message || "Order-ka lama tirtiri karin.");
                                    return;
                                }
                                alert("Order-ka ayaa loo raray recycle bin.");
                                loadOrders();
                                loadRecycleBin();
                                loadDashboardStatistics();
                            }).catch(function (error) {
                                console.error("Delete order error:", error);
                                alert("Order-ka lama tirtiri karo.");
                            });
                        }
                    });
                });
            }
        }

        if (recentOrdersBody) {
            const recent = [...orders].slice(-5).reverse();
            if (recent.length === 0) {
                recentOrdersBody.innerHTML = `
                    <tr>
                        <td colspan="5">Wali orders ma jiraan.</td>
                    </tr>
                `;
            } else {
                recentOrdersBody.innerHTML = recent.map(function (order) {
                    const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-";
                    return `
                        <tr data-order-id="${order.id}" style="cursor:pointer;">
                            <td>${order.id}</td>
                            <td>${order.customerName}</td>
                            <td>${order.country || order.origin || "-"}</td>
                            <td>${order.status || "Pending"}</td>
                            <td>${date}</td>
                        </tr>
                    `;
                }).join("");

                recentOrdersBody.querySelectorAll("tr[data-order-id]").forEach(function (row) {
                    row.addEventListener("click", function () {
                        const orderId = this.dataset.orderId;
                        const selected = orders.find(function (order) {
                            return order.id === orderId;
                        });

                        if (!selected) return;

                        document.getElementById("orderCustomerName").value = selected.customerName || "";
                        document.getElementById("orderPhone").value = selected.phone || "";
                        document.getElementById("orderItemName").value = selected.itemName || selected.product || "";
                        document.getElementById("orderQuantity").value = selected.quantity || 1;
                        document.getElementById("orderCountry").value = selected.country || selected.origin || "";
                        document.getElementById("orderRecipientName").value = selected.recipientName || "";
                        document.getElementById("orderRecipientPhone").value = selected.recipientPhone || "";
                        document.getElementById("orderRecipientAddress").value = selected.recipientAddress || "";
                        document.getElementById("orderDeliveryFee").value = selected.deliveryFee || 0;
                        document.getElementById("orderTotalAmount").value = selected.totalAmount || selected.amount || 0;
                        document.getElementById("orderStatus").value = selected.status || "Pending";
                        if (orderEditIdInput) orderEditIdInput.value = selected.id;
                        openPage("orders");
                        orderFormBox.classList.remove("hidden");
                    });
                });
            }
        }

    } catch (error) {
        console.error("Load orders error:", error);
    }
}

async function loadRecycleBin() {
    const token = localStorage.getItem("maanToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/recycle-bin`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const result = await response.json();
        const tableBody = document.getElementById("recycleBinTableBody");

        if (!tableBody) return;

        const items = result.data || [];

        if (items.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6">Recycle bin is empty.</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = items.map(function (item) {
            const date = item.deletedAt ? new Date(item.deletedAt).toLocaleString() : "-";
            return `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.customerName || "-"}</td>
                    <td>${item.itemName || item.product || "-"}</td>
                    <td>${item.country || item.origin || "-"}</td>
                    <td>${date}</td>
                    <td>
                        <button class="small-btn" type="button" data-restore-id="${item.id}">Restore</button>
                    </td>
                </tr>
            `;
        }).join("");

        tableBody.querySelectorAll("button[data-restore-id]").forEach(function (button) {
            button.addEventListener("click", function () {
                const id = this.dataset.restoreId;
                fetch(`${API_URL}/recycle-bin/orders/${id}/restore`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }).then(async function (response) {
                    const result = await response.json();
                    if (!result.success) {
                        alert(result.message || "Order-ka lama soo celin karo.");
                        return;
                    }
                    alert("Order-ka waa la soo celiyay.");
                    loadRecycleBin();
                    loadOrders();
                    loadDashboardStatistics();
                }).catch(function (error) {
                    console.error("Restore order error:", error);
                    alert("Order-ka lama soo celin karo.");
                });
            });
        });

    } catch (error) {
        console.error("Load recycle bin error:", error);
    }
}

// ==========================================
// PAYMENTS - DATABASE
// ==========================================

const addPaymentBtn = document.getElementById("addPaymentBtn");
const cancelPaymentBtn = document.getElementById("cancelPaymentBtn");
const paymentFormBox = document.getElementById("paymentFormBox");
const paymentForm = document.getElementById("paymentForm");

if (addPaymentBtn) {
    addPaymentBtn.addEventListener("click", function () {
        paymentFormBox.classList.remove("hidden");
    });
}

if (cancelPaymentBtn) {
    cancelPaymentBtn.addEventListener("click", function () {
        paymentForm.reset();
        delete paymentForm.dataset.editId;
        paymentForm.querySelector("button[type='submit']").textContent = "💾 Kaydi Payment";
        paymentFormBox.classList.add("hidden");
    });
}

if (paymentForm) {
    paymentForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const payload = {
            customerName: document.getElementById("paymentCustomerName").value.trim(),
            amount: Number(document.getElementById("paymentAmount").value || 0),
            method: document.getElementById("paymentMethod").value,
            reference: document.getElementById("paymentReference").value.trim(),
            description: document.getElementById("paymentDescription").value.trim()
        };

        if (!payload.customerName || !payload.amount) {
            alert("Customer iyo lacagta waa muhiim.");
            return;
        }

        const editId = paymentForm.dataset.editId;
        const isEditMode = Boolean(editId);

        try {
            const response = await fetch(`${API_URL}/payments${isEditMode ? `/${editId}` : ""}`, {
                method: isEditMode ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("maanToken") || ""}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Payment-ka lama kaydin.");
                return;
            }

            paymentForm.reset();
            delete paymentForm.dataset.editId;
            paymentForm.querySelector("button[type='submit']").textContent = "💾 Kaydi Payment";
            paymentFormBox.classList.add("hidden");
            loadPayments();
            loadDashboardStatistics();
            loadAccounting();
        } catch (error) {
            console.error("Payment save error:", error);
            alert("Server-ka lama xiriiri karo.");
        }
    });
}

async function loadPayments() {
    const token = localStorage.getItem("maanToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/payments`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const result = await response.json();
        if (!result.success) return;

        const tableBody = document.getElementById("paymentsTableBody");
        if (!tableBody) return;

        const payments = result.data || [];
        if (payments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7">Wali payments lama gelin.</td></tr>`;
            return;
        }

        tableBody.innerHTML = payments.map(function (payment) {
            const date = payment.date ? new Date(payment.date).toLocaleDateString() : "-";
            return `
                <tr>
                    <td>${payment.id}</td>
                    <td>${payment.customerName}</td>
                    <td>${payment.method || "Cash"}</td>
                    <td>${formatMoney(payment.amount || 0)}</td>
                    <td>${payment.reference || "-"}</td>
                    <td>${date}</td>
                    <td>
                        <div class="action-inline">
                            <button type="button" class="small-btn" data-payment-edit="${payment.id}">Edit</button>
                            <button type="button" class="small-btn danger-btn" data-payment-delete="${payment.id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        tableBody.querySelectorAll("[data-payment-edit]").forEach(function (button) {
            button.addEventListener("click", function () {
                const id = this.dataset.paymentEdit;
                const payment = payments.find(item => item.id === id);
                if (!payment) return;

                document.getElementById("paymentCustomerName").value = payment.customerName || "";
                document.getElementById("paymentAmount").value = payment.amount || 0;
                document.getElementById("paymentMethod").value = payment.method || "Cash";
                document.getElementById("paymentReference").value = payment.reference || "";
                document.getElementById("paymentDescription").value = payment.description || "";
                paymentForm.dataset.editId = id;
                paymentFormBox.classList.remove("hidden");
            });
        });

        tableBody.querySelectorAll("[data-payment-delete]").forEach(function (button) {
            button.addEventListener("click", async function () {
                const id = this.dataset.paymentDelete;
                if (!confirm("Ma hubtaa inaad tirtirto payment-kan?")) return;

                try {
                    const response = await fetch(`${API_URL}/payments/${id}`, {
                        method: "DELETE",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const result = await response.json();
                    if (!result.success) {
                        alert(result.message || "Payment-ka lama tirtiri karo.");
                        return;
                    }
                    loadPayments();
                    loadDashboardStatistics();
                    loadAccounting();
                } catch (error) {
                    console.error("Delete payment error:", error);
                }
            });
        });

        if (paymentForm && paymentForm.dataset.editId) {
            paymentForm.querySelector("button[type='submit']").textContent = "💾 Update Payment";
        }
    } catch (error) {
        console.error("Load payments error:", error);
    }
}

// ==========================================
// DELIVERIES - DATABASE
// ==========================================

const addDeliveryBtn = document.getElementById("addDeliveryBtn");
const cancelDeliveryBtn = document.getElementById("cancelDeliveryBtn");
const deliveryFormBox = document.getElementById("deliveryFormBox");
const deliveryForm = document.getElementById("deliveryForm");

if (addDeliveryBtn) {
    addDeliveryBtn.addEventListener("click", function () {
        deliveryFormBox.classList.remove("hidden");
    });
}

if (cancelDeliveryBtn) {
    cancelDeliveryBtn.addEventListener("click", function () {
        deliveryForm.reset();
        delete deliveryForm.dataset.editId;
        deliveryFormBox.classList.add("hidden");
    });
}

if (deliveryForm) {
    deliveryForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const payload = {
            customerName: document.getElementById("deliveryCustomerName").value.trim(),
            phone: document.getElementById("deliveryPhone").value.trim(),
            country: document.getElementById("deliveryCountry").value,
            item: document.getElementById("deliveryItem").value,
            address: document.getElementById("deliveryAddress").value.trim(),
            status: document.getElementById("deliveryStatus").value
        };

        if (!payload.customerName || !payload.phone || !payload.address) {
            alert("Customer, phone iyo address waa muhiim.");
            return;
        }

        const editId = deliveryForm.dataset.editId;
        const isEditMode = Boolean(editId);

        try {
            const response = await fetch(`${API_URL}/deliveries${isEditMode ? `/${editId}` : ""}`, {
                method: isEditMode ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("maanToken") || ""}`
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Delivery-ga lama kaydin.");
                return;
            }
            deliveryForm.reset();
            delete deliveryForm.dataset.editId;
            deliveryFormBox.classList.add("hidden");
            loadDeliveries();
        } catch (error) {
            console.error("Delivery save error:", error);
            alert("Server-ka lama xiriiri karo.");
        }
    });
}

async function loadDeliveries() {
    const token = localStorage.getItem("maanToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/deliveries`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const result = await response.json();
        if (!result.success) return;

        const deliveries = result.data || [];
        const tableBody = document.getElementById("deliveriesTableBody");
        if (!tableBody) return;

        if (deliveries.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7">Wali deliveries lama gelin.</td></tr>`;
            return;
        }

        tableBody.innerHTML = deliveries.map(function (delivery) {
            return `
                <tr>
                    <td>${delivery.id}</td>
                    <td>${delivery.customerName}</td>
                    <td>${delivery.country || "-"}</td>
                    <td>${delivery.item || "-"}</td>
                    <td>${delivery.address || "-"}</td>
                    <td>${delivery.status || "Pending"}</td>
                    <td>
                        <div class="action-inline">
                            <button type="button" class="small-btn" data-delivery-edit="${delivery.id}">Edit</button>
                            <button type="button" class="small-btn danger-btn" data-delivery-delete="${delivery.id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        tableBody.querySelectorAll("[data-delivery-edit]").forEach(function (button) {
            button.addEventListener("click", function () {
                const id = this.dataset.deliveryEdit;
                const delivery = deliveries.find(item => item.id === id);
                if (!delivery) return;
                document.getElementById("deliveryCustomerName").value = delivery.customerName || "";
                document.getElementById("deliveryPhone").value = delivery.phone || "";
                document.getElementById("deliveryCountry").value = delivery.country || "Somalia";
                document.getElementById("deliveryItem").value = delivery.item || "General";
                document.getElementById("deliveryAddress").value = delivery.address || "";
                document.getElementById("deliveryStatus").value = delivery.status || "Pending";
                deliveryForm.dataset.editId = id;
                deliveryFormBox.classList.remove("hidden");
            });
        });

        tableBody.querySelectorAll("[data-delivery-delete]").forEach(function (button) {
            button.addEventListener("click", async function () {
                const id = this.dataset.deliveryDelete;
                if (!confirm("Ma hubtaa inaad tirtirto delivery-ga?")) return;
                try {
                    const response = await fetch(`${API_URL}/deliveries/${id}`, {
                        method: "DELETE",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const result = await response.json();
                    if (!result.success) {
                        alert(result.message || "Delivery-ga lama tirtiri karo.");
                        return;
                    }
                    loadDeliveries();
                } catch (error) {
                    console.error("Delete delivery error:", error);
                }
            });
        });
    } catch (error) {
        console.error("Load deliveries error:", error);
    }
}

// ==========================================
// SHIPMENTS - DATABASE
// ==========================================

const addShipmentBtn = document.getElementById("addShipmentBtn");
const cancelShipmentBtn = document.getElementById("cancelShipmentBtn");
const shipmentFormBox = document.getElementById("shipmentFormBox");
const shipmentForm = document.getElementById("shipmentForm");

if (addShipmentBtn) {
    addShipmentBtn.addEventListener("click", function () {
        shipmentFormBox.classList.remove("hidden");
    });
}

if (cancelShipmentBtn) {
    cancelShipmentBtn.addEventListener("click", function () {
        shipmentForm.reset();
        delete shipmentForm.dataset.editId;
        shipmentFormBox.classList.add("hidden");
    });
}

if (shipmentForm) {
    shipmentForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const payload = {
            trackingNumber: document.getElementById("shipmentTrackingNumber").value.trim(),
            origin: document.getElementById("shipmentOrigin").value,
            supplier: document.getElementById("shipmentSupplier").value.trim(),
            product: document.getElementById("shipmentProduct").value.trim(),
            status: document.getElementById("shipmentStatus").value
        };

        if (!payload.trackingNumber || !payload.product) {
            alert("Tracking number iyo product waa muhiim.");
            return;
        }

        const editId = shipmentForm.dataset.editId;
        const isEditMode = Boolean(editId);

        try {
            const response = await fetch(`${API_URL}/shipments${isEditMode ? `/${editId}` : ""}`, {
                method: isEditMode ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("maanToken") || ""}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Shipment-ka lama kaydin.");
                return;
            }

            shipmentForm.reset();
            delete shipmentForm.dataset.editId;
            shipmentFormBox.classList.add("hidden");
            loadShipments();
        } catch (error) {
            console.error("Shipment save error:", error);
            alert("Server-ka lama xiriiri karo.");
        }
    });
}

async function loadShipments() {
    const token = localStorage.getItem("maanToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/shipments`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const result = await response.json();
        if (!result.success) return;

        const shipments = result.data || [];
        const tableBody = document.getElementById("shipmentsTableBody");
        if (!tableBody) return;

        if (shipments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7">Wali shipment lama gelin.</td></tr>`;
            return;
        }

        tableBody.innerHTML = shipments.map(function (shipment) {
            return `
                <tr>
                    <td>${shipment.id}</td>
                    <td>${shipment.trackingNumber || "-"}</td>
                    <td>${shipment.origin || "-"}</td>
                    <td>${shipment.supplier || "-"}</td>
                    <td>${shipment.product || "-"}</td>
                    <td>${shipment.status || "In Transit"}</td>
                    <td>
                        <div class="action-inline">
                            <button type="button" class="small-btn" data-shipment-edit="${shipment.id}">Edit</button>
                            <button type="button" class="small-btn danger-btn" data-shipment-delete="${shipment.id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        tableBody.querySelectorAll("[data-shipment-edit]").forEach(function (button) {
            button.addEventListener("click", function () {
                const id = this.dataset.shipmentEdit;
                const shipment = shipments.find(item => item.id === id);
                if (!shipment) return;

                document.getElementById("shipmentTrackingNumber").value = shipment.trackingNumber || "";
                document.getElementById("shipmentOrigin").value = shipment.origin || "China";
                document.getElementById("shipmentSupplier").value = shipment.supplier || "";
                document.getElementById("shipmentProduct").value = shipment.product || "";
                document.getElementById("shipmentStatus").value = shipment.status || "In Transit";
                shipmentForm.dataset.editId = id;
                shipmentFormBox.classList.remove("hidden");
            });
        });

        tableBody.querySelectorAll("[data-shipment-delete]").forEach(function (button) {
            button.addEventListener("click", async function () {
                const id = this.dataset.shipmentDelete;
                if (!confirm("Ma hubtaa inaad tirtirto shipment-ka?")) return;
                try {
                    const response = await fetch(`${API_URL}/shipments/${id}`, {
                        method: "DELETE",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    const result = await response.json();
                    if (!result.success) {
                        alert(result.message || "Shipment-ka lama tirtiri karo.");
                        return;
                    }
                    loadShipments();
                } catch (error) {
                    console.error("Delete shipment error:", error);
                }
            });
        });
    } catch (error) {
        console.error("Load shipments error:", error);
    }
}

async function loadMonthlyBill() {
    const token = localStorage.getItem("maanToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/monthly-bills`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        const bills = result.data || [];

        const activeBill = bills.length ? bills[bills.length - 1] : {
            title: "First Month Free",
            amount: 0,
            dueDate: new Date().toISOString().slice(0, 10),
            status: "Free",
            note: "First monthly billing is free"
        };

        const amountNode = document.getElementById("monthlyBillAmount");
        const statusNode = document.getElementById("monthlyBillStatus");
        const dueDateNode = document.getElementById("monthlyBillDueDate");
        const payBtn = document.getElementById("payMonthlyBillBtn");
        const billRef = document.getElementById("monthlyBillReference");
        const billPayAmount = document.getElementById("monthlyBillPayAmount");

        if (amountNode) amountNode.textContent = formatMoney(Number(activeBill.amount || 0));
        if (statusNode) statusNode.textContent = activeBill.status === "Free" ? "Free" : (activeBill.status || "Unpaid");
        if (dueDateNode) dueDateNode.textContent = activeBill.status === "Free" ? "First month free" : `Due: ${activeBill.dueDate || "-"}`;
        if (billRef) billRef.textContent = activeBill.title || "Monthly Bill";
        if (billPayAmount) billPayAmount.textContent = formatMoney(Number(activeBill.amount || 0));

        if (payBtn) {
            payBtn.textContent = (activeBill.status === "Paid") ? "✅ Bill Paid" : ((activeBill.status === "Free") ? "🎁 First Month Free" : "💳 Pay Bill");
            payBtn.disabled = activeBill.status === "Paid";
            payBtn.classList.toggle("success-btn", activeBill.status !== "Paid");
            payBtn.classList.toggle("small-btn", true);
        }

        const monthlyBillModal = document.getElementById("monthlyBillModal");
        if (monthlyBillModal) {
            monthlyBillModal.classList.add("hidden");
        }

        if (payBtn) {
            payBtn.onclick = function () {
                if (monthlyBillModal) {
                    monthlyBillModal.classList.remove("hidden");
                }
            };
        }

        const closeBtn = document.querySelector("[data-close-monthly-bill='true']");
        if (closeBtn) {
            closeBtn.onclick = function () {
                const box = document.getElementById("monthlyBillModal");
                if (box) box.classList.add("hidden");
            };
        }

        const markPaidBtn = document.getElementById("markMonthlyBillPaidBtn");
        if (markPaidBtn) {
            markPaidBtn.onclick = async function () {
                if (!activeBill || !activeBill.id) return;
                try {
                    const response = await fetch(`${API_URL}/monthly-bills/${activeBill.id}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            ...activeBill,
                            status: "Paid",
                            note: "Paid via payment template"
                        })
                    });
                    const result = await response.json();
                    if (!result.success) {
                        alert(result.message || "Bill-ka lama dajino.");
                        return;
                    }
                    alert("Bill-ka waa la bixiyaa.");
                    document.getElementById("monthlyBillModal").classList.add("hidden");
                    loadMonthlyBill();
                } catch (error) {
                    console.error("Mark paid error:", error);
                    alert("Server-ka lama xiriiri karo.");
                }
            };
        }
    } catch (error) {
        console.error("Load monthly bill error:", error);
    }
}

async function loadAccounting() {
    const token = localStorage.getItem("maanToken");
    if (!token) return;

    try {
        const [ordersRes, paymentsRes, expensesRes] = await Promise.all([
            fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/payments`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/expenses`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const ordersData = await ordersRes.json();
        const paymentsData = await paymentsRes.json();
        const expensesData = await expensesRes.json();

        const orders = ordersData.data || [];
        const payments = paymentsData.data || [];
        const expenses = expensesData.data || [];

        const income = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const orderTotal = orders.reduce((sum, order) => sum + Number(order.totalAmount || order.amount || 0), 0);
        const profit = income - expenseTotal;

        document.getElementById("incomeTotal").textContent = formatMoney(income);
        document.getElementById("expenseTotal").textContent = formatMoney(expenseTotal);
        document.getElementById("profitTotal").textContent = formatMoney(profit);
        document.getElementById("ordersTotalValue").textContent = formatMoney(orderTotal);

        if (document.getElementById("reportOrders")) {
            document.getElementById("reportOrders").textContent = orders.length;
            document.getElementById("reportCustomers").textContent = document.getElementById("totalCustomers")?.textContent || 0;
            document.getElementById("reportRevenue").textContent = formatMoney(income);
            document.getElementById("reportExpenses").textContent = formatMoney(expenseTotal);
        }
    } catch (error) {
        console.error("Accounting load error:", error);
    }
}

async function loadReports() {
    const token = localStorage.getItem("maanToken");
    if (!token) return;

    try {
        const [ordersRes, customersRes, reportsRes, paymentsRes, expensesRes, deliveriesRes, shipmentsRes] = await Promise.all([
            fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/customers`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/reports`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/payments`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/expenses`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/deliveries`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/shipments`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const ordersData = await ordersRes.json();
        const customersData = await customersRes.json();
        const reportsData = await reportsRes.json();
        const paymentsData = await paymentsRes.json();
        const expensesData = await expensesRes.json();
        const deliveriesData = await deliveriesRes.json();
        const shipmentsData = await shipmentsRes.json();

        const orders = ordersData.data || [];
        const customers = customersData.data || [];
        const reports = reportsData.data || [];
        const payments = paymentsData.data || [];
        const expenses = expensesData.data || [];
        const deliveries = deliveriesData.data || [];
        const shipments = shipmentsData.data || [];

        const closingsResponse = await fetch(`${API_URL}/monthly-closings`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const closingsResult = await closingsResponse.json();
        if (!closingsResponse.ok || !closingsResult.success) {
            throw new Error(closingsResult.message || "Xisaab-xirrada lama soo rari karin.");
        }
        const closings = closingsResult.data || [];
        const closingTable = document.getElementById("monthlyClosingsBody");
        if (closingTable) {
            if (!closings.length) {
                closingTable.innerHTML = `<tr><td colspan="7">Weli bil xiran ma jiro. Xisaab-xirku si otomaatig ah ayuu u shaqayn doonaa dhammaadka bisha.</td></tr>`;
            } else {
                const currentUser = JSON.parse(localStorage.getItem("maanUser") || "{}");
                closingTable.innerHTML = closings.slice().sort((a, b) => b.period.localeCompare(a.period)).map(closing => {
                    const isClosed = closing.status !== "reopened";
                    const action = isClosed && currentUser.role === "admin"
                        ? `<button type="button" class="small-btn" data-reopen-month="${escapeHtml(closing.period)}">Reopen Month</button>`
                        : isClosed ? "Admin only" : "Records unlocked";
                    return `<tr>
                        <td>${escapeHtml(closing.period)}</td>
                        <td><span class="closing-status ${isClosed ? "is-closed" : "is-reopened"}">${isClosed ? "Closed" : "Reopened"}</span></td>
                        <td>${formatMoney(closing.revenue)}</td>
                        <td>${formatMoney(closing.expenses)}</td>
                        <td>${formatMoney(closing.profit)}</td>
                        <td>${closing.closedAt ? new Date(closing.closedAt).toLocaleString() : "-"}</td>
                        <td>${action}</td>
                    </tr>`;
                }).join("");

                closingTable.querySelectorAll("[data-reopen-month]").forEach(button => {
                    button.addEventListener("click", async function () {
                        const period = this.dataset.reopenMonth;
                        if (!confirm(`Dib ma u furaysaa ${period}? Diiwaannada muddadaas mar kale waa la beddeli karaa.`)) return;
                        try {
                            const response = await fetch(`${API_URL}/monthly-closings/${encodeURIComponent(period)}/reopen`, {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const result = await response.json();
                            if (!response.ok || !result.success) {
                                alert(result.message || "Bisha dib looma furi karin.");
                                return;
                            }
                            alert(result.message);
                            loadReports();
                        } catch (error) {
                            console.error("Reopen month error:", error);
                            alert("Bisha dib looma furi karin; hubi xiriirka server-ka.");
                        }
                    });
                });
            }
        }

        const cashReceived = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const expensesPaid = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const billedTotal = orders.reduce((sum, order) => sum + Number(order.totalAmount || order.amount || 0), 0);
        const customerDebt = Math.max(0, billedTotal - cashReceived);
        const cashFlow = cashReceived - expensesPaid;
        const incoming = [...deliveries, ...shipments].filter(item => {
            const status = String(item.status || "Pending").toLowerCase();
            return status === "pending" || status === "in transit" || status === "processing";
        });
        const pipelineItems = [...deliveries, ...shipments];
        const pendingCount = pipelineItems.filter(item => String(item.status || "Pending").toLowerCase() === "pending").length;
        const transitCount = pipelineItems.filter(item => String(item.status || "").toLowerCase() === "in transit").length;
        const deliveredCount = pipelineItems.filter(item => String(item.status || "").toLowerCase() === "delivered").length;

        const reportValueMap = {
            reportCashFlow: formatMoney(cashFlow),
            reportProfit: formatMoney(cashFlow),
            reportDebt: formatMoney(customerDebt),
            reportIncoming: incoming.length,
            reportCashReceived: formatMoney(cashReceived),
            reportExpensePaid: formatMoney(expensesPaid),
            reportDebtRow: formatMoney(customerDebt),
            reportPendingDeliveries: pendingCount,
            reportTransitDeliveries: transitCount,
            reportDeliveredDeliveries: deliveredCount
        };
        Object.entries(reportValueMap).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        const cashFlowBar = document.getElementById("reportCashFlowBar");
        if (cashFlowBar) cashFlowBar.style.width = `${Math.min(100, cashReceived ? Math.max(0, (cashFlow / cashReceived) * 100) : 0)}%`;
        const cashFlowNote = document.getElementById("reportCashFlowNote");
        if (cashFlowNote) cashFlowNote.textContent = cashFlow >= 0 ? "Positive cash position" : "Expenses are above received cash";
        const profitNote = document.getElementById("reportProfitNote");
        if (profitNote) profitNote.textContent = cashFlow >= 0 ? "Income less expenses" : "Review costs and collections";
        const debtNote = document.getElementById("reportDebtNote");
        if (debtNote) debtNote.textContent = customerDebt ? `${formatMoney(customerDebt)} still to collect` : "All order balances are clear";
        const incomingNote = document.getElementById("reportIncomingNote");
        if (incomingNote) incomingNote.textContent = incoming.length ? `${incoming.length} active delivery item${incoming.length === 1 ? "" : "s"}` : "No active deliveries";

        const countryCounts = {};
        const productCounts = {};

        orders.forEach(function (order) {
            const country = order.country || order.origin || "Unknown";
            const product = order.itemName || order.product || "Unknown";
            countryCounts[country] = (countryCounts[country] || 0) + 1;
            productCounts[product] = (productCounts[product] || 0) + 1;
        });

        const countryList = document.getElementById("countryReportList");
        const productList = document.getElementById("productReportList");

        if (countryList) {
            const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            countryList.innerHTML = sortedCountries.length ? sortedCountries.map(([name, count]) => `<li>${name}: ${count}</li>`).join("") : "<li>No country data</li>";
        }

        if (productList) {
            const sortedProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            productList.innerHTML = sortedProducts.length ? sortedProducts.map(([name, count]) => `<li>${name}: ${count}</li>`).join("") : "<li>No product data</li>";
        }

        if (document.getElementById("reportOrders")) {
            document.getElementById("reportOrders").textContent = orders.length;
            document.getElementById("reportCustomers").textContent = customers.length;
        }

        const tableBody = document.getElementById("reportsTableBody");
        if (tableBody) {
            if (reports.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="7">Wali report lama gelin.</td></tr>`;
                return;
            }

            tableBody.innerHTML = reports.map(function (report) {
                const date = report.createdAt ? new Date(report.createdAt).toLocaleDateString() : "-";
                const summary = report.summary ? (report.summary.length > 50 ? report.summary.slice(0, 50) + "..." : report.summary) : "-";
                const actions = report.autoGenerated === "monthly-closing"
                    ? "System generated"
                    : `<button type="button" class="small-btn" data-report-edit="${escapeHtml(report.id)}">Edit</button>
                       <button type="button" class="small-btn danger-btn" data-report-delete="${escapeHtml(report.id)}">Delete</button>`;
                return `
                    <tr>
                        <td>${escapeHtml(report.id)}</td>
                        <td>${escapeHtml(report.title || "-")}</td>
                        <td>${escapeHtml(report.category || "General")}</td>
                        <td>${escapeHtml(report.status || "Draft")}</td>
                        <td>${escapeHtml(summary)}</td>
                        <td>${escapeHtml(date)}</td>
                        <td>
                            <div class="action-inline">
                                ${actions}
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            tableBody.querySelectorAll("[data-report-edit]").forEach(function (button) {
                button.addEventListener("click", function () {
                    const id = this.dataset.reportEdit;
                    const report = reports.find(item => item.id === id);
                    if (!report) return;

                    document.getElementById("reportTitle").value = report.title || "";
                    document.getElementById("reportCategory").value = report.category || "General";
                    document.getElementById("reportStatus").value = report.status || "Draft";
                    document.getElementById("reportSummary").value = report.summary || "";
                    reportForm.dataset.editId = id;
                    reportFormBox.classList.remove("hidden");
                });
            });

            tableBody.querySelectorAll("[data-report-delete]").forEach(function (button) {
                button.addEventListener("click", async function () {
                    const id = this.dataset.reportDelete;
                    if (!confirm("Ma hubtaa inaad tirtirto report-ka?")) return;
                    try {
                        const response = await fetch(`${API_URL}/reports/${id}`, {
                            method: "DELETE",
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        const result = await response.json();
                        if (!result.success) {
                            alert(result.message || "Report-ka lama tirtiri karo.");
                            return;
                        }
                        loadReports();
                    } catch (error) {
                        console.error("Delete report error:", error);
                    }
                });
            });
        }
    } catch (error) {
        console.error("Reports load error:", error);
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}

const addReportBtn = document.getElementById("addReportBtn");
const cancelReportBtn = document.getElementById("cancelReportBtn");
const reportFormBox = document.getElementById("reportFormBox");
const reportForm = document.getElementById("reportForm");

if (addReportBtn) {
    addReportBtn.addEventListener("click", function () {
        reportFormBox.classList.remove("hidden");
    });
}

if (cancelReportBtn) {
    cancelReportBtn.addEventListener("click", function () {
        reportForm.reset();
        delete reportForm.dataset.editId;
        reportFormBox.classList.add("hidden");
    });
}

if (reportForm) {
    reportForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const payload = {
            title: document.getElementById("reportTitle").value.trim(),
            category: document.getElementById("reportCategory").value,
            status: document.getElementById("reportStatus").value,
            summary: document.getElementById("reportSummary").value.trim()
        };

        if (!payload.title) {
            alert("Report title waa muhiim.");
            return;
        }

        const editId = reportForm.dataset.editId;
        const isEditMode = Boolean(editId);

        try {
            const response = await fetch(`${API_URL}/reports${isEditMode ? `/${editId}` : ""}`, {
                method: isEditMode ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("maanToken") || ""}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Report-ka lama kaydin.");
                return;
            }

            reportForm.reset();
            delete reportForm.dataset.editId;
            reportFormBox.classList.add("hidden");
            loadReports();
        } catch (error) {
            console.error("Report save error:", error);
            alert("Server-ka lama xiriiri karo.");
        }
    });
}

async function loadSettings() {
    const token = localStorage.getItem("maanToken");
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/settings`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        if (!result.success || !result.data) return;

        const settings = result.data;
        const menuItems = settings.menuItems || defaultMenuItems;

        function applyBrandImages(logoValue) {
            const dashboardLogo = document.getElementById("dashboardBrandLogo");
            const dashboardBrandMark = document.querySelector(".dashboard-brand-mark");
            const loginBrandSvg = document.getElementById("loginBrandSvg");
            const loginBrandImage = document.getElementById("loginBrandImage");
            const sidebarBrandSvg = document.getElementById("sidebarBrandSvg");
            const sidebarBrandImage = document.getElementById("sidebarBrandImage");

            if (dashboardLogo) {
                if (logoValue) {
                    dashboardLogo.src = logoValue;
                    dashboardLogo.classList.remove("hidden");
                    if (dashboardBrandMark) dashboardBrandMark.style.display = "none";
                } else {
                    dashboardLogo.src = "";
                    dashboardLogo.classList.add("hidden");
                    if (dashboardBrandMark) dashboardBrandMark.style.display = "flex";
                }
            }

            if (loginBrandSvg && loginBrandImage) {
                if (logoValue) {
                    loginBrandImage.src = logoValue;
                    loginBrandImage.classList.remove("hidden");
                    loginBrandSvg.classList.add("hidden");
                } else {
                    loginBrandImage.src = "";
                    loginBrandImage.classList.add("hidden");
                    loginBrandSvg.classList.remove("hidden");
                }
            }

            if (sidebarBrandSvg && sidebarBrandImage) {
                if (logoValue) {
                    sidebarBrandImage.src = logoValue;
                    sidebarBrandImage.classList.remove("hidden");
                    sidebarBrandSvg.classList.add("hidden");
                } else {
                    sidebarBrandImage.src = "";
                    sidebarBrandImage.classList.add("hidden");
                    sidebarBrandSvg.classList.remove("hidden");
                }
            }
        }

        applyBrandImages(settings.logo || "");

        const profileCompanyNameInput = document.getElementById("profileCompanyNameInput");
        const profileCompanyEmailInput = document.getElementById("profileCompanyEmailInput");
        const profileCashierNameInput = document.getElementById("profileCashierNameInput");
        const profileCashierEmailInput = document.getElementById("profileCashierEmailInput");
        const profilePhoneInput = document.getElementById("profilePhoneInput");
        const profileDashboardLogoPreview = document.getElementById("profileDashboardLogoPreview");
        const profileCashierImagePreview = document.getElementById("profileCashierImagePreview");

        if (profileCompanyNameInput) profileCompanyNameInput.value = settings.companyName || "Maan Transmitter & Deliver";
        if (profileCompanyEmailInput) profileCompanyEmailInput.value = settings.email || "";
        const profileCompanyPhoneInput = document.getElementById("profileCompanyPhoneInput");
        const profileBusinessAddressInput = document.getElementById("profileBusinessAddressInput");
        const profileMerchantAddressInput = document.getElementById("profileMerchantAddressInput");
        const profileBusinessDetailsInput = document.getElementById("profileBusinessDetailsInput");
        if (profileCompanyPhoneInput) profileCompanyPhoneInput.value = settings.companyPhone || settings.phone || "";
        if (profileBusinessAddressInput) profileBusinessAddressInput.value = settings.businessAddress || "";
        if (profileMerchantAddressInput) profileMerchantAddressInput.value = settings.merchantAddress || "";
        if (profileBusinessDetailsInput) profileBusinessDetailsInput.value = settings.businessDetails || "";
        if (profileCashierNameInput) profileCashierNameInput.value = JSON.parse(localStorage.getItem("maanUser") || "{}")?.name || "Admin";
        if (profileCashierEmailInput) profileCashierEmailInput.value = JSON.parse(localStorage.getItem("maanUser") || "{}")?.email || "";
        if (profilePhoneInput) profilePhoneInput.value = JSON.parse(localStorage.getItem("maanUser") || "{}")?.phone || "";
        if (profileDashboardLogoPreview) {
            if (settings.logo) {
                profileDashboardLogoPreview.src = settings.logo;
                profileDashboardLogoPreview.classList.remove("hidden");
            } else {
                profileDashboardLogoPreview.src = "";
                profileDashboardLogoPreview.classList.add("hidden");
            }
        }
        if (profileCashierImagePreview) {
            const currentUser = JSON.parse(localStorage.getItem("maanUser") || "{}");
            const profileImage = currentUser.avatar || (currentUser.role === "admin" ? settings.cashierImage : "");
            if (profileImage) {
                profileCashierImagePreview.src = profileImage;
                profileCashierImagePreview.onerror = () => profileCashierImagePreview.classList.add("hidden");
                profileCashierImagePreview.classList.remove("hidden");
            } else {
                profileCashierImagePreview.src = "";
                profileCashierImagePreview.classList.add("hidden");
            }
        }

        document.getElementById("companyNameInput").value = settings.companyName || "Maan Transmitter & Deliver";
        document.getElementById("companyCountryInput").value = settings.country || "Somalia";
        document.getElementById("companyCurrencyInput").value = settings.currency || "USD";
        document.getElementById("companyPhoneInput").value = settings.phone || "";
        document.getElementById("companyPhoneInput").value = settings.companyPhone || settings.phone || "";
        document.getElementById("companyEmailInput").value = settings.email || "";
        document.getElementById("companyWebsiteInput").value = settings.website || "";
        document.getElementById("companyEdahabNumberInput").value = settings.edahabNumber || "613582084";
        document.getElementById("companyEdahabAltInput").value = settings.edahabAltNumber || "62 35820842";
        document.getElementById("paymentTemplateTextInput").value = settings.paymentTemplate || "Please send payment confirmation after transfer.";

        document.getElementById("menuDashboardLabel").value = menuItems.dashboard || defaultMenuItems.dashboard;
        document.getElementById("menuOrdersLabel").value = menuItems.orders || defaultMenuItems.orders;
        document.getElementById("menuRecycleBinLabel").value = menuItems.recycleBin || defaultMenuItems.recycleBin;
        document.getElementById("menuCustomersLabel").value = menuItems.customers || defaultMenuItems.customers;
        document.getElementById("menuDeliveriesLabel").value = menuItems.deliveries || defaultMenuItems.deliveries;
        document.getElementById("menuShipmentsLabel").value = menuItems.shipments || defaultMenuItems.shipments;
        document.getElementById("menuPaymentsLabel").value = menuItems.payments || defaultMenuItems.payments;
        document.getElementById("menuReportsLabel").value = menuItems.reports || defaultMenuItems.reports;
        document.getElementById("menuMonthlyLabel").value = menuItems.monthly || defaultMenuItems.monthly;

        applyMenuLabels(menuItems);

        const templateBox = document.getElementById("paymentAccountInfo");
        if (templateBox) {
            templateBox.innerHTML = `
                <div><strong>Company:</strong> ${settings.companyName || "Maan Transmitter & Deliver"}</div>
                <div><strong>E-Dahab:</strong> ${settings.edahabNumber || "613582084"}</div>
                <div><strong>Second Number:</strong> ${settings.edahabAltNumber || "62 35820842"}</div>
                <div><strong>Message:</strong> ${settings.paymentTemplate || "Please send payment confirmation after transfer."}</div>
            `;
        }

        const logoPreview = document.getElementById("companyLogoPreview");
        if (settings.logo) {
            logoPreview.src = settings.logo;
            logoPreview.classList.remove("hidden");
        }

        const cashierImagePreview = document.getElementById("cashierImagePreview");
        if (settings.cashierImage) {
            cashierImagePreview.src = settings.cashierImage;
            cashierImagePreview.classList.remove("hidden");
        }
    } catch (error) {
        console.error("Settings load error:", error);
    }
}

const settingsForm = document.getElementById("settingsForm");
const companyLogoInput = document.getElementById("companyLogoInput");
const companyLogoPreview = document.getElementById("companyLogoPreview");
const cashierImageInput = document.getElementById("cashierImageInput");
const cashierImagePreview = document.getElementById("cashierImagePreview");
const removeCashierImageBtn = document.getElementById("removeCashierImageBtn");
const removeCompanyLogoBtn = document.getElementById("removeCompanyLogoBtn");
const profileSettingsForm = document.getElementById("profileSettingsForm");
const profileDashboardLogoInput = document.getElementById("profileDashboardLogoInput");
const profileDashboardLogoPreview = document.getElementById("profileDashboardLogoPreview");
const profileCashierImageInput = document.getElementById("profileCashierImageInput");
const profileCashierImagePreview = document.getElementById("profileCashierImagePreview");
const removeProfileDashboardLogoBtn = document.getElementById("removeProfileDashboardLogoBtn");
const removeProfileCashierImageBtn = document.getElementById("removeProfileCashierImageBtn");
const profileForm = document.getElementById("profileForm");
const passwordForm = document.getElementById("passwordForm");
const profileAvatarInput = document.getElementById("profileAvatarInput");
const profileAvatarPreview = document.getElementById("profileAvatarPreview");
const removeProfileAvatarBtn = document.getElementById("removeProfileAvatarBtn");

if (profileAvatarInput) {
    profileAvatarInput.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (!file || !profileAvatarPreview) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            profileAvatarPreview.src = event.target.result;
            profileAvatarPreview.classList.remove("hidden");
            const avatarBox = document.querySelector(".profile-avatar-box");
            avatarBox?.classList.add("has-image");
            avatarBox?.classList.remove("has-default");
        };
        reader.readAsDataURL(file);
    });
}

if (removeProfileAvatarBtn) {
    removeProfileAvatarBtn.addEventListener("click", function () {
        if (profileAvatarPreview) {
            profileAvatarPreview.src = "";
            profileAvatarPreview.classList.add("hidden");
        }
        if (profileAvatarInput) profileAvatarInput.value = "";
        const avatarBox = document.querySelector(".profile-avatar-box");
        avatarBox?.classList.add("has-default");
        avatarBox?.classList.remove("has-image");
    });
}

function populateProfileForm() {
    const savedUser = localStorage.getItem("maanUser");
    if (!savedUser) return;

    try {
        const user = JSON.parse(savedUser);
        const nameInput = document.getElementById("profileNameInput");
        const emailInput = document.getElementById("profileEmailInput");
        const phoneInput = document.getElementById("profilePhoneInput");
        const avatarPreview = document.getElementById("profileAvatarPreview");
        const avatarBox = document.querySelector(".profile-avatar-box");

        if (nameInput) nameInput.value = user.name || "Admin";
        if (emailInput) emailInput.value = user.email || "admin@maan.com";
        if (phoneInput) phoneInput.value = user.phone || "";

        if (avatarPreview) {
            if (user.avatar) {
                avatarPreview.src = user.avatar;
                avatarPreview.classList.remove("hidden");
                avatarBox?.classList.add("has-image");
                avatarBox?.classList.remove("has-default");
            } else {
                avatarPreview.src = "";
                avatarPreview.classList.add("hidden");
                avatarBox?.classList.add("has-default");
                avatarBox?.classList.remove("has-image");
            }
        }
    } catch (error) {
        console.error("Profile form population error:", error);
    }
}

if (companyLogoInput) {
    companyLogoInput.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (!file || !companyLogoPreview) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            companyLogoPreview.src = event.target.result;
            companyLogoPreview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    });
}

if (profileDashboardLogoInput) {
    profileDashboardLogoInput.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (!file || !profileDashboardLogoPreview) return;
        if (file.size > 5 * 1024 * 1024) {
            alert("Company logo-gu waa inuu ka yaraadaa 5 MB.");
            this.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = function (event) {
            profileDashboardLogoPreview.src = event.target.result;
            profileDashboardLogoPreview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    });
}

if (cashierImageInput) {
    cashierImageInput.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (!file || !cashierImagePreview) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            cashierImagePreview.src = event.target.result;
            cashierImagePreview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    });
}

if (profileCashierImageInput) {
    profileCashierImageInput.addEventListener("change", function () {
        const file = this.files && this.files[0];
        if (!file || !profileCashierImagePreview) return;
        if (file.size > 5 * 1024 * 1024) {
            alert("Profile photo-gu waa inuu ka yaraadaa 5 MB.");
            this.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onload = function (event) {
            profileCashierImagePreview.src = event.target.result;
            profileCashierImagePreview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    });
}

if (removeCashierImageBtn) {
    removeCashierImageBtn.addEventListener("click", function () {
        if (cashierImagePreview) {
            cashierImagePreview.src = "";
            cashierImagePreview.classList.add("hidden");
        }
        if (cashierImageInput) cashierImageInput.value = "";
    });
}

if (removeProfileCashierImageBtn) {
    removeProfileCashierImageBtn.addEventListener("click", function () {
        if (profileCashierImagePreview) {
            profileCashierImagePreview.src = "";
            profileCashierImagePreview.classList.add("hidden");
        }
        if (profileCashierImageInput) profileCashierImageInput.value = "";
    });
}

if (removeCompanyLogoBtn) {
    removeCompanyLogoBtn.addEventListener("click", function () {
        if (companyLogoPreview) {
            companyLogoPreview.src = "";
            companyLogoPreview.classList.add("hidden");
        }
        if (companyLogoInput) companyLogoInput.value = "";
    });
}

if (removeProfileDashboardLogoBtn) {
    removeProfileDashboardLogoBtn.addEventListener("click", function () {
        if (profileDashboardLogoPreview) {
            profileDashboardLogoPreview.src = "";
            profileDashboardLogoPreview.classList.add("hidden");
        }
        if (profileDashboardLogoInput) profileDashboardLogoInput.value = "";
    });
}

if (settingsForm) {
    settingsForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const token = localStorage.getItem("maanToken");
        if (!token) return;

        let logo = document.getElementById("companyLogoPreview")?.src || "";
        if (companyLogoInput && companyLogoInput.files && companyLogoInput.files[0]) {
            logo = companyLogoPreview?.src || "";
        }

        let cashierImage = document.getElementById("cashierImagePreview")?.src || "";
        if (cashierImageInput && cashierImageInput.files && cashierImageInput.files[0]) {
            cashierImage = cashierImagePreview?.src || "";
        }

        const payload = {
            companyName: document.getElementById("companyNameInput").value.trim(),
            country: document.getElementById("companyCountryInput").value.trim(),
            phone: document.getElementById("companyPhoneInput").value.trim(),
            email: document.getElementById("companyEmailInput").value.trim(),
            currency: document.getElementById("companyCurrencyInput").value.trim(),
            website: document.getElementById("companyWebsiteInput").value.trim(),
            edahabNumber: document.getElementById("companyEdahabNumberInput").value.trim() || "613582084",
            edahabAltNumber: document.getElementById("companyEdahabAltInput").value.trim() || "62 35820842",
            paymentTemplate: document.getElementById("paymentTemplateTextInput").value.trim() || "Please send payment confirmation after transfer.",
            logo: logo || "",
            cashierImage: cashierImage || "",
            menuItems: {
                dashboard: document.getElementById("menuDashboardLabel").value.trim() || defaultMenuItems.dashboard,
                orders: document.getElementById("menuOrdersLabel").value.trim() || defaultMenuItems.orders,
                recycleBin: document.getElementById("menuRecycleBinLabel").value.trim() || defaultMenuItems.recycleBin,
                customers: document.getElementById("menuCustomersLabel").value.trim() || defaultMenuItems.customers,
                deliveries: document.getElementById("menuDeliveriesLabel").value.trim() || defaultMenuItems.deliveries,
                shipments: document.getElementById("menuShipmentsLabel").value.trim() || defaultMenuItems.shipments,
                payments: document.getElementById("menuPaymentsLabel").value.trim() || defaultMenuItems.payments,
                reports: document.getElementById("menuReportsLabel").value.trim() || defaultMenuItems.reports,
                monthly: document.getElementById("menuMonthlyLabel").value.trim() || defaultMenuItems.monthly
            }
        };

        try {
            const response = await fetch(`${API_URL}/settings`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Settings-ka lama kaydin.");
                return;
            }
            alert("Settings-ka waa la keydiyay.");
            loadSettings();
        } catch (error) {
            console.error("Settings save error:", error);
            alert("Server-ka lama xiriiri karo.");
        }
    });
}

if (profileForm) {
    profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const token = localStorage.getItem("maanToken");
        if (!token) return;

        const name = document.getElementById("profileNameInput")?.value.trim();
        const email = document.getElementById("profileEmailInput")?.value.trim();
        const phone = document.getElementById("profilePhoneInput")?.value.trim();

        if (!name || !email || !phone) {
            alert("Cashier name, email-ka, iyo lambarka telefoonka waa in la buuxiyaa.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/admin/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name, email, phone, avatar: "" })
            });

            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Profile-ka lama badalin.");
                return;
            }

            const savedUser = JSON.parse(localStorage.getItem("maanUser") || "{}");
            const updatedUser = { ...savedUser, name: result.data.name, email: result.data.email, phone: result.data.phone || "", avatar: result.data.avatar || "" };
            localStorage.setItem("maanUser", JSON.stringify(updatedUser));

            const headerUserAvatar = document.querySelector(".user-avatar");
            if (headerUserAvatar) {
                headerUserAvatar.innerHTML = updatedUser.avatar
                    ? `<img src="${updatedUser.avatar}" alt="Admin avatar">`
                    : "A";
            }

            document.getElementById("currentUser").textContent = result.data.name || "Admin";
            closeAdminModalView();
            alert("Profile-ka waa la badalay.");
        } catch (error) {
            console.error("Profile update error:", error);
            alert("Server-ka lama xiriiri karo.");
        }
    });
}

if (profileSettingsForm) {
    const changePasswordBtn = document.getElementById("profileChangePasswordBtn");
    const cancelProfileChangesBtn = document.getElementById("cancelProfileChangesBtn");
    const saveProfileChangesBtn = document.getElementById("saveProfileChangesBtn");
    const profileSaveStatus = document.getElementById("profileSaveStatus");

    changePasswordBtn?.addEventListener("click", function () {
        openAdminModal("password");
    });

    cancelProfileChangesBtn?.addEventListener("click", function () {
        profileSettingsForm.reset();
        if (profileDashboardLogoInput) profileDashboardLogoInput.value = "";
        if (profileCashierImageInput) profileCashierImageInput.value = "";
        if (profileSaveStatus) profileSaveStatus.textContent = "";
        loadSettings();
    });

    profileSettingsForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const token = localStorage.getItem("maanToken");
        if (!token) return;

        const savedUser = JSON.parse(localStorage.getItem("maanUser") || "{}");
        const payload = {
            name: document.getElementById("profileCashierNameInput").value.trim(),
            email: document.getElementById("profileCashierEmailInput").value.trim(),
            phone: document.getElementById("profilePhoneInput").value.trim(),
            avatar: profileCashierImagePreview?.classList.contains("hidden") ? "" : profileCashierImagePreview?.src || "",
            companyName: document.getElementById("profileCompanyNameInput").value.trim(),
            companyEmail: document.getElementById("profileCompanyEmailInput").value.trim(),
            companyPhone: document.getElementById("profileCompanyPhoneInput").value.trim(),
            businessAddress: document.getElementById("profileBusinessAddressInput").value.trim(),
            merchantAddress: document.getElementById("profileMerchantAddressInput").value.trim(),
            businessDetails: document.getElementById("profileBusinessDetailsInput").value.trim(),
            logo: profileDashboardLogoPreview?.classList.contains("hidden") ? "" : profileDashboardLogoPreview?.src || ""
        };

        if (!payload.name || !payload.email || !payload.phone || !payload.companyName) {
            alert("Magaca, email-ka, telefoonka, iyo magaca shirkaddu waa in la buuxiyaa.");
            return;
        }

        try {
            if (saveProfileChangesBtn) saveProfileChangesBtn.disabled = true;
            const response = await fetch(`${API_URL}/admin/profile-settings`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                showProfileMessage(result.message || "Profile-ka lama kaydin.", true);
                alert(result.message || "Profile-ka iyo xogta ganacsiga lama kaydin.");
                return;
            }

            const updatedUser = { ...savedUser, ...result.data.user };
            localStorage.setItem("maanUser", JSON.stringify(updatedUser));

            const headerUserAvatar = document.querySelector(".user-avatar");
            if (headerUserAvatar && updatedUser.avatar) {
                headerUserAvatar.innerHTML = `<img src="${updatedUser.avatar}" alt="Profile photo">`;
            } else if (headerUserAvatar) {
                headerUserAvatar.textContent = (updatedUser.name || "A").charAt(0).toUpperCase();
            }
            const currentUser = document.getElementById("currentUser");
            if (currentUser) currentUser.textContent = updatedUser.name || "Admin";
            if (profileCashierImageInput) profileCashierImageInput.value = "";
            if (profileDashboardLogoInput) profileDashboardLogoInput.value = "";
            if (profileSaveStatus) profileSaveStatus.textContent = result.message;

            await loadSettings();
            alert(result.message);
        } catch (error) {
            console.error("Profile settings update error:", error);
            showProfileMessage(error.message || "Profile-ka lama kaydin.", true);
            alert("Server-ka lama xiriiri karo.");
        } finally {
            if (saveProfileChangesBtn) saveProfileChangesBtn.disabled = false;
        }
    });
}

function showProfileMessage(message, isError = false) {
    const status = document.getElementById("profileSaveStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("profile-status-error", isError);
}

async function loadBackups() {
    const tableBody = document.getElementById("backupListBody");
    if (!tableBody) return;

    const currentUser = JSON.parse(localStorage.getItem("maanUser") || "{}");
    document.querySelectorAll("[data-profile-admin-only]").forEach(section => {
        section.classList.toggle("hidden", currentUser.role !== "admin");
    });
    if (currentUser.role !== "admin") return;

    const token = localStorage.getItem("maanToken");
    try {
        const response = await fetch(`${API_URL}/admin/backups`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || "Liiska backup-yada lama soo rari karin.");
        }

        const backups = result.data || [];
        tableBody.innerHTML = backups.length ? backups.map(backup => `
            <tr>
                <td>${escapeHtml(backup.filename)}</td>
                <td>${escapeHtml(new Date(backup.createdAt).toLocaleString())}</td>
                <td>${escapeHtml(backup.type)}</td>
                <td>
                    <div class="action-inline">
                        <button type="button" class="small-btn" data-backup-download="${escapeHtml(backup.filename)}">Download</button>
                        <button type="button" class="small-btn danger-btn" data-backup-restore="${escapeHtml(backup.filename)}">Restore</button>
                    </div>
                </td>
            </tr>
        `).join("") : `<tr><td colspan="4">Backup wali lama samayn.</td></tr>`;
    } catch (error) {
        console.error("Load backups error:", error);
        tableBody.innerHTML = `<tr><td colspan="4">${escapeHtml(error.message || "Backup-yada lama soo rari karin.")}</td></tr>`;
    }
}

async function downloadAdminFile(endpoint, fallbackName) {
    const token = localStorage.getItem("maanToken");
    const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
        let message = "Faylka lama soo dejisan karin.";
        try {
            const result = await response.json();
            message = result.message || message;
        } catch (error) {
            console.error("Download error response could not be read:", error);
        }
        throw new Error(message);
    }

    const disposition = response.headers.get("Content-Disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || fallbackName;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function restoreDatabaseBackup(backupData) {
    const token = localStorage.getItem("maanToken");
    const response = await fetch(`${API_URL}/admin/backups/restore`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(backupData)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.message || "Backup-ka lama restore-gareyn.");
    }
    return result;
}

const createBackupBtn = document.getElementById("createBackupBtn");
if (createBackupBtn) {
    createBackupBtn.addEventListener("click", async function () {
        const token = localStorage.getItem("maanToken");
        createBackupBtn.disabled = true;
        try {
            const response = await fetch(`${API_URL}/admin/backups`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || "Backup-ka lama samayn karin.");
            }
            showProfileMessage(result.message);
            await loadBackups();
            alert(`${result.message}\n${result.data.filename}`);
        } catch (error) {
            console.error("Create backup error:", error);
            showProfileMessage(error.message || "Backup-ka lama samayn karin.", true);
            alert(error.message || "Backup-ka lama samayn karin.");
        } finally {
            createBackupBtn.disabled = false;
        }
    });
}

const profilePage = document.getElementById("profilePage");
profilePage?.addEventListener("click", async function (event) {
    const exportButton = event.target.closest("[data-export-format]");
    if (exportButton) {
        try {
            await downloadAdminFile(
                `${API_URL}/admin/exports/${encodeURIComponent(exportButton.dataset.exportFormat)}`,
                `maan-full-data.${exportButton.dataset.exportFormat}`
            );
        } catch (error) {
            console.error("Full data export error:", error);
            alert(error.message || "Xogta lama export-gareyn karin.");
        }
        return;
    }

    const downloadButton = event.target.closest("[data-backup-download]");
    if (downloadButton) {
        try {
            await downloadAdminFile(
                `${API_URL}/admin/backups/${encodeURIComponent(downloadButton.dataset.backupDownload)}/download`,
                downloadButton.dataset.backupDownload
            );
        } catch (error) {
            console.error("Backup download error:", error);
            alert(error.message || "Backup-ka lama soo dejisan karin.");
        }
        return;
    }

    const restoreButton = event.target.closest("[data-backup-restore]");
    if (!restoreButton) return;
    const filename = restoreButton.dataset.backupRestore;
    if (!confirm(`Restore ${filename}?\n\nDatabase-ka hadda jira waa la beddeli doonaa. Server-ku marka hore badbaado ayuu ka samayn doonaa.`)) return;

    try {
        const token = localStorage.getItem("maanToken");
        const downloadResponse = await fetch(`${API_URL}/admin/backups/${encodeURIComponent(filename)}/download`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!downloadResponse.ok) throw new Error("Backup-ka lama soo akhrin karin.");
        const backupData = await downloadResponse.json();
        const result = await restoreDatabaseBackup(backupData);
        alert(result.message);
        window.location.reload();
    } catch (error) {
        console.error("Restore backup error:", error);
        alert(error.message || "Backup-ka lama restore-gareyn.");
    }
});

const restoreBackupFileInput = document.getElementById("restoreBackupFile");
restoreBackupFileInput?.addEventListener("change", async function () {
    const file = this.files && this.files[0];
    if (!file) return;
    if (file.size > 90 * 1024 * 1024) {
        alert("Backup file-ku wuxuu ka weyn yahay 90 MB.");
        this.value = "";
        return;
    }
    if (!confirm(`Restore ${file.name}?\n\nDatabase-ka hadda jira waa la beddeli doonaa. Server-ku marka hore badbaado ayuu ka samayn doonaa.`)) {
        this.value = "";
        return;
    }

    try {
        const backupData = JSON.parse(await file.text());
        const result = await restoreDatabaseBackup(backupData);
        alert(result.message);
        window.location.reload();
    } catch (error) {
        console.error("Uploaded backup restore error:", error);
        alert(error instanceof SyntaxError ? "Faylka la doortay ma aha JSON sax ah." : error.message || "Backup-ka lama restore-gareyn.");
        this.value = "";
    }
});

if (passwordForm) {
    passwordForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const token = localStorage.getItem("maanToken");
        if (!token) return;

        const email = document.getElementById("emailPasswordInput")?.value.trim() || "";
        const phone = document.getElementById("phonePasswordInput")?.value.trim() || "";
        const currentPassword = document.getElementById("currentPasswordInput")?.value || "";
        const newPassword = document.getElementById("newPasswordInput")?.value || "";
        const confirmPassword = document.getElementById("confirmPasswordInput")?.value || "";

        if (!email || !phone || !currentPassword || !newPassword || !confirmPassword) {
            alert("Email-ka, lambarka telefoonka, password-ka hadda jira, iyo kan cusubi dhammaan waa in la buuxiyaa.");
            return;
        }

        if (newPassword.length < 6) {
            alert("Password-ka cusub waa inuu ahaado 6 xaraf ama ka badan.");
            return;
        }

        if (newPassword !== confirmPassword) {
            alert("Password-ka cusub ma u dhigma.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/admin/password`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ email, phone, currentPassword, newPassword })
            });

            const result = await response.json();
            if (!result.success) {
                alert(result.message || "Password-ka lama bedelin.");
                return;
            }

            const savedUser = JSON.parse(localStorage.getItem("maanUser") || "{}");
            const updatedUser = { ...savedUser, email: result.data?.email || email, phone: result.data?.phone || phone };
            localStorage.setItem("maanUser", JSON.stringify(updatedUser));

            passwordForm.reset();
            closeAdminModalView();
            alert("Email-ka iyo password-ka waa la bedelay.");
        } catch (error) {
            console.error("Password update error:", error);
            alert("Server-ka lama xiriiri karo.");
        }
    });
}

// ==========================================
// CUSTOMERS - DATABASE
// ==========================================

const addCustomerBtn =
    document.getElementById("addCustomerBtn");

const cancelCustomerBtn =
    document.getElementById("cancelCustomerBtn");

const customerFormBox =
    document.getElementById("customerFormBox");

const customerForm =
    document.getElementById("customerForm");


// ==========================================
// OPEN CUSTOMER FORM
// ==========================================

if (addCustomerBtn) {

    addCustomerBtn.addEventListener(
        "click",
        function () {

            customerFormBox.classList.remove("hidden");

        }
    );

}


// ==========================================
// CANCEL CUSTOMER FORM
// ==========================================

if (cancelCustomerBtn) {

    cancelCustomerBtn.addEventListener(
        "click",
        function () {

            customerForm.reset();
            delete customerForm.dataset.editId;
            customerFormBox.classList.add("hidden");

        }
    );

}


// ==========================================
// ADD CUSTOMER TO DATABASE
// ==========================================

if (customerForm) {

    customerForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const name =
                document.getElementById(
                    "customerName"
                ).value.trim();


            const phone =
                document.getElementById(
                    "customerPhone"
                ).value.trim();


            const email =
                document.getElementById(
                    "customerEmail"
                ).value.trim();


            const address =
                document.getElementById(
                    "customerAddress"
                ).value.trim();


            const token =
                localStorage.getItem(
                    "maanToken"
                );


            if (!token) {

                alert(
                    "Fadlan marka hore login samee."
                );

                return;

            }

            const editId = customerForm.dataset.editId;
            const isEditMode = Boolean(editId);

            try {

                const response =
                    await fetch(
                        `${API_URL}/customers${isEditMode ? `/${editId}` : ""}`,
                        {

                            method: isEditMode ? "PUT" : "POST",

                            headers: {

                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${token}`

                            },

                            body: JSON.stringify({

                                name: name,

                                phone: phone,

                                email: email,

                                address: address

                            })

                        }
                    );


                const result =
                    await response.json();


                if (!result.success) {

                    alert(
                        result.message ||
                        (isEditMode ? "Customer-ka lama badalin." : "Customer-ka lama kaydin.")
                    );

                    return;

                }

                alert(
                    isEditMode ? "Customer-ka waa la cusbooneysiiyay." : "Customer-ka si guul leh ayaa loo kaydiyay."
                );


                customerForm.reset();
                delete customerForm.dataset.editId;
                customerFormBox.classList.add("hidden");


                loadCustomers();
                loadDashboardStatistics();


            } catch (error) {

                console.error(
                    "Customer error:",
                    error
                );


                alert(
                    "Server-ka lama xiriiri karo."
                );

            }

        }
    );

}


// ==========================================
// LOAD CUSTOMERS
// ==========================================

async function loadCustomers() {

    const token =
        localStorage.getItem(
            "maanToken"
        );


    if (!token) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/customers`,
                {

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            );


        const result =
            await response.json();


        if (!result.success) {

            return;

        }


        const customers =
            result.data;


        const tableBody =
            document.getElementById(
                "customersTableBody"
            );


        if (!tableBody) {

            return;

        }


        if (customers.length === 0) {

            tableBody.innerHTML = `

                <tr>

                    <td colspan="6">
                        Wali customer lama gelin.
                    </td>

                </tr>

            `;

            return;

        }


        tableBody.innerHTML =
            customers.map(
                function (customer) {

                    const date =
                        customer.createdAt
                            ? new Date(
                                customer.createdAt
                            ).toLocaleDateString()
                            : "-";


                    return `

                        <tr>

                            <td>
                                ${customer.id}
                            </td>

                            <td>
                                ${customer.name}
                            </td>

                            <td>
                                ${customer.phone}
                            </td>

                            <td>
                                ${customer.email || "-"}
                            </td>

                            <td>
                                ${customer.address || "-"}
                            </td>

                            <td>
                                ${date}
                            </td>

                            <td>
                                <div class="action-inline">
                                    <button type="button" class="small-btn" data-customer-edit="${customer.id}">Edit</button>
                                    <button type="button" class="small-btn danger-btn" data-customer-delete="${customer.id}">Delete</button>
                                </div>
                            </td>

                        </tr>

                    `;

                }
            ).join("");

        tableBody.querySelectorAll("[data-customer-edit]").forEach(function (button) {
            button.addEventListener("click", function () {
                const id = this.dataset.customerEdit;
                const customer = customers.find(item => item.id === id);
                if (!customer) return;

                document.getElementById("customerName").value = customer.name || "";
                document.getElementById("customerPhone").value = customer.phone || "";
                document.getElementById("customerEmail").value = customer.email || "";
                document.getElementById("customerAddress").value = customer.address || "";
                customerForm.dataset.editId = id;
                customerFormBox.classList.remove("hidden");
            });
        });

        tableBody.querySelectorAll("[data-customer-delete]").forEach(function (button) {
            button.addEventListener("click", async function () {
                const id = this.dataset.customerDelete;
                if (!confirm("Ma hubtaa inaad tirtirto customer-kan?")) return;

                try {
                    const response = await fetch(`${API_URL}/customers/${id}`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${localStorage.getItem("maanToken") || ""}`
                        }
                    });
                    const result = await response.json();
                    if (!result.success) {
                        alert(result.message || "Customer-ka lama tirtiri karo.");
                        return;
                    }
                    loadCustomers();
                    loadDashboardStatistics();
                } catch (error) {
                    console.error("Delete customer error:", error);
                    alert("Customer-ka lama tirtiri karo.");
                }
            });
        });


    } catch (error) {

        console.error(
            "Load customers error:",
            error
        );

    }

}