"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, Eye, Plus, RefreshCw, Search } from "lucide-react";
import Navbar from "../components/navbar/navbar";
import RegDebtor from "../components/customerRegistration/registration";
import CustomerProfile from "../components/customerProfile/profile";
import ProfileEdit from "../components/customerEdit/profileEdit";
import NewInstallment from "../components/new-Installment/new-installment";
import "../styles/customerRegistration/registration.css";
import "../styles/customers/customers.css";

/* ------------------------------------------------------------------
   Config + data
------------------------------------------------------------------ */

const FILTERS = ["All Customers", "Daily", "Monthly", "Monthly Interest", "Weekly", "Cheque"];

const LOAN_TYPES = [
    { label: "Daily", field: "dailyRegNo" },
    { label: "Weekly", field: "weeklyRegNo" },
    { label: "Monthly", field: "monthlyRegNo" },
    { label: "Monthly Interest", field: "MintRegNo" },
    { label: "Cheque", field: "chqRegNo" },
];

const getCustomerTypes = (customer) =>
    LOAN_TYPES.filter(({ field }) => String(customer?.[field] ?? "").trim())
        .map(({ label }) => label);

const getCustomerRegNumbers = (customer) =>
    LOAN_TYPES.filter(({ field }) => String(customer?.[field] ?? "").trim())
        .map(({ label, field }) => ({ type: label, reg: String(customer[field]).trim() }));

const getPrimaryRegNo = (customer) => {
    const registrations = getCustomerRegNumbers(customer);
    return registrations[0]?.reg || customer?.newRegNo || customer?.registrationNo || "—";
};

const displayValue = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return "—";
    return String(value);
};

const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};


/* ------------------------------------------------------------------
   Icons
------------------------------------------------------------------ */

// Solid (filled) cogwheel for the settings button
function CogIcon({ size = 20 }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="currentColor"
            fillRule="evenodd"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M10.06 4.55 L10.29 1.74 L13.71 1.74 L13.94 4.55 A7.7 7.7 0 0 1 15.90 5.36 L18.05 3.54 L20.46 5.95 L18.64 8.10 A7.7 7.7 0 0 1 19.45 10.06 L22.26 10.29 L22.26 13.71 L19.45 13.94 A7.7 7.7 0 0 1 18.64 15.90 L20.46 18.05 L18.05 20.46 L15.90 18.64 A7.7 7.7 0 0 1 13.94 19.45 L13.71 22.26 L10.29 22.26 L10.06 19.45 A7.7 7.7 0 0 1 8.10 18.64 L5.95 20.46 L3.54 18.05 L5.36 15.90 A7.7 7.7 0 0 1 4.55 13.94 L1.74 13.71 L1.74 10.29 L4.55 10.06 A7.7 7.7 0 0 1 5.36 8.10 L3.54 5.95 L5.95 3.54 L8.10 5.36 A7.7 7.7 0 0 1 10.06 4.55 Z M8.6 12a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0Z" />
        </svg>
    );
}

/* ------------------------------------------------------------------
   Hooks
------------------------------------------------------------------ */

// Observes any [data-reveal] element that isn't visible yet.
// Re-runs when the content section is re-mounted (a form is closed).
function useScrollReveal(deps) {
    useEffect(() => {
        const els = document.querySelectorAll("[data-reveal]:not(.is-visible)");
        if (typeof IntersectionObserver === "undefined") {
            els.forEach((el) => el.classList.add("is-visible"));
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        );
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

/* ------------------------------------------------------------------
   Page
------------------------------------------------------------------ */

export default function Customers() {
    // Only one form is open at a time
    const [showRegistration, setShowRegistration] = useState(false);
    const [showNewInstallment, setShowNewInstallment] = useState(false);

    const [customers, setCustomers] = useState([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [customersError, setCustomersError] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);
    // The profile opens in place of the table, like the forms
    const formOpen = showRegistration || showNewInstallment || Boolean(selectedCustomer);
    const [filter, setFilter] = useState(FILTERS[0]);
    const [query, setQuery] = useState("");

    const tabsRef = useRef(null);
    const tabRefs = useRef({});

    // Banner starts rolled up; the settings button slides it down
    const [bannerOpen, setBannerOpen] = useState(false);
    const heroRef = useRef(null);
    const settingsRef = useRef(null);
    const collapseTimer = useRef(null);
    const wasOpen = useRef(false);
    const [indicator, setIndicator] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });

    useScrollReveal([showRegistration, showNewInstallment, selectedCustomer]);

    const loadCustomers = async () => {
        setLoadingCustomers(true);
        setCustomersError("");
        try {
            const response = await fetch("/api/customers/get", {
                method: "GET",
                cache: "no-store",
                headers: { "Cache-Control": "no-cache" },
            });
            const result = await response.json();
            if (!response.ok || result.success === false) {
                throw new Error(result.error || result.message || "Failed to load customers.");
            }
            setCustomers(Array.isArray(result.customers) ? result.customers : []);
        } catch (error) {
            console.error("Load customers error:", error);
            setCustomersError(error.message || "Unable to load customers. Please try again.");
        } finally {
            setLoadingCustomers(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, []);

    /* ---- Rolling banner ---- */

    const clearCollapseTimer = () => {
        if (collapseTimer.current) {
            clearTimeout(collapseTimer.current);
            collapseTimer.current = null;
        }
    };

    const toggleBanner = () => {
        clearCollapseTimer();
        setBannerOpen((open) => !open);
    };

    // Roll the banner back up. A small delay lets the person see their choice land first.
    const closeBanner = (delay = 0) => {
        clearCollapseTimer();
        if (delay > 0) {
            collapseTimer.current = setTimeout(() => setBannerOpen(false), delay);
        } else {
            setBannerOpen(false);
        }
    };

    useEffect(() => () => clearTimeout(collapseTimer.current), []);

    // Escape rolls the banner up
    useEffect(() => {
        if (!bannerOpen) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") setBannerOpen(false);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [bannerOpen]);

    // Keep keyboard focus sensible: into the active tab on open, back to the settings button on close
    useEffect(() => {
        if (bannerOpen) {
            tabRefs.current[filter]?.focus({ preventScroll: true });
        } else if (wasOpen.current && heroRef.current?.contains(document.activeElement)) {
            settingsRef.current?.focus({ preventScroll: true });
        }
        wasOpen.current = bannerOpen;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bannerOpen]);

    const openRegistration = () => {
        closeBanner();
        setSelectedCustomer(null);
        setShowNewInstallment(false);
        setShowRegistration(true);
    };

    const openNewInstallment = () => {
        closeBanner();
        setSelectedCustomer(null);
        setShowRegistration(false);
        setShowNewInstallment(true);
    };

    const closeForms = () => {
        setShowRegistration(false);
        setShowNewInstallment(false);
        setSelectedCustomer(null);
    };

    // Sliding pill behind the active tab (re-measured on resize and once fonts load)
    useLayoutEffect(() => {
        const measure = () => {
            const el = tabRefs.current[filter];
            if (!el) return;
            setIndicator({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight, ready: true });
        };
        measure();

        // On narrow screens the tab bar scrolls sideways, so keep the active tab centred
        const bar = tabsRef.current;
        const active = tabRefs.current[filter];
        if (bar && active && bar.scrollWidth > bar.clientWidth) {
            bar.scrollTo({ left: active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
        }

        window.addEventListener("resize", measure);
        document.fonts?.ready.then(measure);
        return () => window.removeEventListener("resize", measure);
    }, [filter]);

    // Tab bar scrolling: edge-fade hints (data-scroll-start / data-scroll-end) + mouse drag-to-scroll.
    // Touch screens use native swipe scrolling (see .debtors-tabs in the CSS).
    useEffect(() => {
        const bar = tabsRef.current;
        if (!bar) return;

        const updateEdges = () => {
            const max = bar.scrollWidth - bar.clientWidth;
            bar.dataset.scrollStart = bar.scrollLeft > 4 ? "true" : "false";
            bar.dataset.scrollEnd = max > 4 && bar.scrollLeft < max - 4 ? "true" : "false";
        };
        updateEdges();
        bar.addEventListener("scroll", updateEdges, { passive: true });
        window.addEventListener("resize", updateEdges);
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateEdges) : null;
        ro?.observe(bar);

        let startX = 0;
        let startScroll = 0;
        let dragging = false;
        let moved = false;

        const onDown = (e) => {
            if (e.pointerType !== "mouse" || e.button !== 0) return;
            if (bar.scrollWidth <= bar.clientWidth) return;
            dragging = true;
            moved = false;
            startX = e.clientX;
            startScroll = bar.scrollLeft;
        };
        const onMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 5) {
                moved = true;
                bar.classList.add("is-dragging");
            }
            if (moved) bar.scrollLeft = startScroll - dx;
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            bar.classList.remove("is-dragging");
        };
        // a drag must not count as a tab click
        const onClickCapture = (e) => {
            if (moved) {
                e.preventDefault();
                e.stopPropagation();
                moved = false;
            }
        };

        bar.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
        bar.addEventListener("click", onClickCapture, true);

        return () => {
            bar.removeEventListener("scroll", updateEdges);
            window.removeEventListener("resize", updateEdges);
            ro?.disconnect();
            bar.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            bar.removeEventListener("click", onClickCapture, true);
        };
    }, []);

    // collapse is true only for real clicks; arrow-key browsing keeps the banner open
    const selectFilter = (f, collapse = false) => {
        setFilter(f);
        closeForms();
        if (collapse) closeBanner(420);
    };

    // Arrow-key navigation across the tabs
    const handleTabKeyDown = (e) => {
        const i = FILTERS.indexOf(filter);
        let next = null;
        if (e.key === "ArrowRight") next = (i + 1) % FILTERS.length;
        else if (e.key === "ArrowLeft") next = (i - 1 + FILTERS.length) % FILTERS.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = FILTERS.length - 1;
        if (next === null) return;
        e.preventDefault();
        selectFilter(FILTERS[next]);
        tabRefs.current[FILTERS[next]]?.focus({ preventScroll: true });
    };


    const handleCustomerSubmit = async (data) => {
        try {
            const response = await fetch("/api/customers/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...data,
                    newRegNo: data.registrationNo,
                    contact: data.tele,
                    businessRegNo: data.businessRegistrationNo,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                alert(
                    result.error ||
                    result.message ||
                    "Failed to register customer."
                );
                return;
            }

            alert(
                result.message ||
                "Customer registered successfully."
            );

            closeForms();
            await loadCustomers();
        } catch (error) {
            console.error("Customer registration error:", error);
            alert("Unable to connect to the server. Please try again.");
        }
    };


    const handleNewInstallmentSubmit = (data) => {
        console.log("New installment:", data);

        // Later:
        // fetch("/api/loans", {
        //   method: "POST",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify(data),
        // });

        closeForms();
    };

    const customerLabel = (customer) => customer?.fullName || customer?.name || "customer";

    const handleEditCustomer = (customer) => {
        setEditingCustomer(customer);
    };

    const handleSaveCustomer = async (updatedData) => {
        const response = await fetch("/api/customers/put", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedData),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || result.message || "Failed to update customer."
            );
        }

        // Update the currently displayed profile immediately.
        setSelectedCustomer((previous) => ({
            ...previous,
            ...updatedData,
            updatedAt: new Date().toISOString(),
        }));

        // Refresh the customer table data.
        await loadCustomers();

        setEditingCustomer(null);
    };

    const handleDeleteCustomer = async (customer) => {
        if (!window.confirm(`Delete ${customerLabel(customer)}? This cannot be undone.`)) return;

        // TODO: connect to your delete API, then refresh the table
        // const response = await fetch("/api/customers/delete", {
        //   method: "DELETE",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ id: customer.id }),
        // });
        // if (response.ok) await loadCustomers();
        console.log("Delete customer:", customer);
    };

    const byType = useMemo(
        () => filter === FILTERS[0]
            ? customers
            : customers.filter((customer) => getCustomerTypes(customer).includes(filter)),
        [customers, filter]
    );

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return byType;
        return byType.filter((customer) => {
            const searchable = [
                customer.fullName,
                customer.name,
                customer.nic,
                customer.id,
                customer.contact,
                customer.tele,
                customer.dailyRegNo,
                customer.weeklyRegNo,
                customer.monthlyRegNo,
                customer.MintRegNo,
                customer.chqRegNo,
                customer.businessType,
            ].filter(Boolean).join(" ").toLowerCase();
            return searchable.includes(q);
        });
    }, [byType, query]);

    return (
        <main className="min-h-screen bg-[#171717]">
            <div className="debtors-navbar-fixed">
                <Navbar />
            </div>

            <div className="debtors-page">
                {/* Hero */}
                <div
                    className={`debtors-scrim${bannerOpen ? " is-visible" : ""}`}
                    onClick={() => closeBanner()}
                    aria-hidden="true"
                />
                <section
                    ref={heroRef}
                    className={`debtors-hero ${bannerOpen ? "is-open" : "is-collapsed"}`}
                >
                    <div className="debtors-hero__glow" />
                    <div className="debtors-hero__stripes">
                        <span className="debtors-hero__stripe debtors-hero__stripe--1" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--2" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--3" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--4" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--5" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--6" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--7" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--8" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--9" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--10" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--11" />
                        <span className="debtors-hero__stripe debtors-hero__stripe--12" />
                    </div>

                    <div className="debtors-hero__content" id="debtors-hero-panel">
                        <div className="debtors-hero__top">
                            <div className="debtors-hero__heading">
                                <h1 className="debtors-hero__title">CUSTOMERS</h1>
                                <span className="debtors-hero__meta" aria-live="polite">
                                    {byType.length} {byType.length === 1 ? "customer" : "customers"}
                                </span>
                            </div>

                            <div className="debtors-hero__actions">
                                <button
                                    type="button"
                                    className="debtors-hero__btn debtors-hero__btn--primary"
                                    onClick={openRegistration}
                                >
                                    <Plus size={16} strokeWidth={2.5} />
                                    Customer
                                </button>
                                <button
                                    type="button"
                                    className="debtors-hero__btn debtors-hero__btn--ghost"
                                    onClick={openNewInstallment}
                                >
                                    <Plus size={16} strokeWidth={2.5} />
                                    Installment
                                </button>
                                <button
                                    type="button"
                                    className="debtors-hero__btn debtors-hero__btn--ghost debtors-hero__btn--icon"
                                    onClick={() => closeBanner()}
                                    aria-label="Roll up banner"
                                    title="Roll up"
                                >
                                    <ChevronUp size={18} strokeWidth={2.3} />
                                </button>
                            </div>
                        </div>

                        {/* Filter tabs */}
                        <div
                            ref={tabsRef}
                            className="debtors-tabs"
                            role="tablist"
                            aria-label="Customer type"
                            onKeyDown={handleTabKeyDown}
                        >
                            <span
                                className={`debtors-tabs__indicator${indicator.ready ? " is-ready" : ""}`}
                                style={{
                                    width: indicator.width,
                                    height: indicator.height,
                                    transform: `translate(${indicator.left}px, ${indicator.top}px)`,
                                }}
                                aria-hidden="true"
                            />
                            {FILTERS.map((f) => (
                                <button
                                    key={f}
                                    ref={(el) => (tabRefs.current[f] = el)}
                                    type="button"
                                    role="tab"
                                    aria-selected={filter === f}
                                    aria-controls="customers-panel"
                                    tabIndex={filter === f ? 0 : -1}
                                    className={`debtors-tabs__btn${filter === f ? " is-active" : ""}`}
                                    onClick={() => selectFilter(f, true)}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Rolled-up strip: settings button, page name and current tab */}
                    <div className="debtors-hero__bar">
                        <h1 className="debtors-hero__bar-title">CUSTOMERS</h1>
                        <span key={filter} className="debtors-hero__bar-tab" aria-live="polite">
                            {filter}
                        </span>
                        <button
                            ref={settingsRef}
                            type="button"
                            className="debtors-hero__settings"
                            onClick={toggleBanner}
                            aria-label="Open customer settings"
                            aria-expanded={bannerOpen}
                            aria-controls="debtors-hero-panel"
                            title="Settings"
                        >
                            <CogIcon size={20} />
                        </button>
                    </div>
                </section>

                {/* Body */}
                <div className={`debtors-body${!formOpen ? " debtors-body--table" : ""}`}>
                    {showRegistration ? (
                        <RegDebtor onClose={closeForms} onSubmit={handleCustomerSubmit} />
                    ) : showNewInstallment ? (
                        <NewInstallment onClose={closeForms} onSubmit={handleNewInstallmentSubmit} />
                    ) : selectedCustomer ? (
                        <CustomerProfile
                            customer={selectedCustomer}
                            onClose={() => setSelectedCustomer(null)}
                            onEdit={handleEditCustomer}
                            onDelete={handleDeleteCustomer}
                        />
                    ) : (
                        <section className="debtors-content" id="customers-panel" role="tabpanel">
                            {/* Dark card: same surface as the register form. Only the table panel scrolls. */}
                            <div className="debtors-card" data-reveal>
                                <div className="debtors-card__bg" aria-hidden="true">
                                    <div className="debtors-card__glow" />
                                    <span className="debtors-card__stripe debtors-card__stripe--1" />
                                    <span className="debtors-card__stripe debtors-card__stripe--2" />
                                    <span className="debtors-card__stripe debtors-card__stripe--3" />
                                    <span className="debtors-card__stripe debtors-card__stripe--4" />
                                    <span className="debtors-card__stripe debtors-card__stripe--5" />
                                    <span className="debtors-card__stripe debtors-card__stripe--6" />
                                </div>

                                <div className="debtors-toolbar">
                                    <h2 className="debtors-section-title">
                                        {filter === FILTERS[0] ? "All customers" : `${filter} customers`}
                                        <span className="debtors-count" aria-live="polite">
                                            {visible.length}
                                        </span>
                                    </h2>

                                    <label className="debtors-search">
                                        <Search size={16} className="debtors-search__icon" aria-hidden="true" />
                                        <input
                                            className="debtors-input"
                                            type="search"
                                            autoComplete="off"
                                            placeholder="Search name, NIC, contact or registration ID"
                                            aria-label="Search customers by name, NIC, contact or registration ID"
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                        />
                                    </label>
                                </div>

                                <div className="debtors-table-wrap" role="region" aria-label="Customers table" tabIndex={0}>
                                    <table className="debtors-table">
                                        <thead>
                                            <tr className="debtors-table__group-row">
                                                <th rowSpan={2}>Name</th>
                                                <th rowSpan={2}>NIC</th>
                                                <th rowSpan={2}>Contact</th>
                                                <th rowSpan={2}>Business type</th>
                                                <th rowSpan={2}>Business Reg. No.</th>
                                                <th colSpan={5} scope="colgroup" className="debtors-table__group">Registration Numbers</th>
                                                <th rowSpan={2}>Status</th>
                                                <th rowSpan={2}>Loyalty</th>
                                                <th rowSpan={2}>Registered</th>
                                                <th rowSpan={2} className="debtors-table__actions-head">Actions</th>
                                            </tr>
                                            <tr className="debtors-table__sub-row">
                                                <th scope="col" className="debtors-table__sub debtors-table__sub--first">Daily</th>
                                                <th scope="col" className="debtors-table__sub">Weekly</th>
                                                <th scope="col" className="debtors-table__sub">Monthly</th>
                                                <th scope="col" className="debtors-table__sub">M. Int</th>
                                                <th scope="col" className="debtors-table__sub debtors-table__sub--last">Cheque</th>
                                            </tr>
                                        </thead>
                                        <tbody key={filter}>
                                            {loadingCustomers ? (
                                                <tr>
                                                    <td colSpan={14} className="debtors-table__empty">Loading customers…</td>
                                                </tr>
                                            ) : customersError ? (
                                                <tr>
                                                    <td colSpan={14} className="debtors-table__empty">
                                                        <div className="flex flex-col items-center gap-3 py-3">
                                                            <span>{customersError}</span>
                                                            <button type="button" className="debtors-hero__btn debtors-hero__btn--ghost" onClick={loadCustomers}>
                                                                <RefreshCw size={15} /> Retry
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : visible.length > 0 ? (
                                                visible.map((customer, i) => {
                                                    const types = getCustomerTypes(customer);
                                                    const regNumbers = getCustomerRegNumbers(customer);
                                                    const loyalty = displayValue(customer.loyalty);
                                                    const loyaltyClass = loyalty.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                                                    return (
                                                        <tr key={customer.id || customer.nic || getPrimaryRegNo(customer)} style={{ "--i": i }}>
                                                            <td className="debtors-table__name">{displayValue(customer.fullName || customer.name)}</td>
                                                            <td>{displayValue(customer.nic || customer.id)}</td>
                                                            <td>{displayValue(customer.contact || customer.tele)}</td>
                                                            <td>{displayValue(customer.businessType)}</td>
                                                            <td>{displayValue(customer.businessRegNo)}</td>
                                                            <td className="debtors-table__reg debtors-table__reg--first">{displayValue(customer.dailyRegNo)}</td>
                                                            <td className="debtors-table__reg">{displayValue(customer.weeklyRegNo)}</td>
                                                            <td className="debtors-table__reg">{displayValue(customer.monthlyRegNo)}</td>
                                                            <td className="debtors-table__reg">{displayValue(customer.MintRegNo)}</td>
                                                            <td className="debtors-table__reg debtors-table__reg--last">{displayValue(customer.chqRegNo)}</td>
                                                            <td><span className="debtors-badge">{displayValue(customer.status)}</span></td>
                                                            <td>
                                                                {loyalty !== "—" ? <span className={`debtors-loyalty debtors-loyalty--${loyaltyClass}`}>{loyalty}</span> : "—"}
                                                            </td>
                                                            <td className="debtors-table__date">{formatDate(customer.createdAt)}</td>
                                                            <td>
                                                                <div className="debtors-actions">
                                                                    <button
                                                                        type="button"
                                                                        className="debtors-action debtors-action--view"
                                                                        onClick={() => setSelectedCustomer(customer)}
                                                                        aria-label={`View ${customerLabel(customer)} details`}
                                                                        title="View"
                                                                    >
                                                                        <Eye size={16} strokeWidth={2.1} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={14} className="debtors-table__empty">
                                                        {query.trim()
                                                            ? `No customers match “${query.trim()}”. Check the spelling or clear the search.`
                                                            : "No customers in this category yet. Use Customer to add one."}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {editingCustomer && (
                <ProfileEdit
                    customer={editingCustomer}
                    onClose={() => setEditingCustomer(null)}
                    onSave={handleSaveCustomer}
                />
            )}

        </main>
    );
}