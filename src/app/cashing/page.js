"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, Search } from "lucide-react";
import Navbar from "../components/navbar/navbar";
import "../styles/home/home.css";
import "../styles/cashing/cashing.css";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const TABS = [
    { id: "option1", label: "Option 1" },
    { id: "option2", label: "Option 2" },
    { id: "view", label: "View" },
];

const FORM_TABS = TABS.filter((tab) => tab.id !== "view");

// Share of the written amount that is withheld. 0.1 = 10%.
// Change a value here if Option 1 and Option 2 ever need different rates.
const WITHHOLD_RATE = {
    option1: 0.1,
    option2: 0.1,
};

const OPTION_LABEL = Object.fromEntries(
    FORM_TABS.map((tab) => [tab.id, tab.label])
);

const emptyForm = {
    name: "",
    nic: "",
    chequeNo: "",
    dateIssued: "",
    writtenAmount: "",
    passingDate: "",
};

const initialForms = Object.fromEntries(
    FORM_TABS.map((tab) => [tab.id, { ...emptyForm }])
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const money = (value) =>
    `Rs. ${Number(value ?? 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const round2 = (value) => Math.round(value * 100) / 100;

// 50,000 at 10%  ->  withheld 5,000 and exchanged 45,000
function calculate(writtenAmount, optionId) {
    const written = Number(writtenAmount);

    if (!Number.isFinite(written) || written <= 0) {
        return { withheld: 0, exchanged: 0 };
    }

    const withheld = round2(written * (WITHHOLD_RATE[optionId] ?? 0));
    const exchanged = round2(written - withheld);

    return { withheld, exchanged };
}

const formatDate = (value) => {
    if (!value) return "—";

    // "YYYY-MM-DD" is parsed as local time so the date never shifts a day
    const date = new Date(`${value}T00:00:00`);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
};

// Columns of the View table. `text` returns what is shown (and searched) for a row.
const VIEW_COLUMNS = [
    { key: "option", label: "Option", text: (r) => OPTION_LABEL[r.option] ?? r.option, badge: true },
    { key: "name", label: "Name", text: (r) => r.name },
    { key: "nic", label: "NIC", text: (r) => r.nic },
    { key: "chequeNo", label: "Cheque No", text: (r) => r.chequeNo },
    { key: "dateIssued", label: "Date Issued", text: (r) => formatDate(r.dateIssued) },
    { key: "writtenAmount", label: "Written Amount", text: (r) => money(r.writtenAmount), num: true },
    { key: "passingDate", label: "Passing Date", text: (r) => formatDate(r.passingDate) },
    { key: "amountExchanged", label: "Amount Exchanged", text: (r) => money(r.amountExchanged), num: true },
    { key: "amountWithheld", label: "Amount Withheld", text: (r) => money(r.amountWithheld), num: true },
];

// Old NIC (9 digits + V/X) or new NIC (12 digits)
const NIC_PATTERN = /^(\d{9}[vVxX]|\d{12})$/;

function validate(form) {
    const errors = {};

    if (!form.name.trim()) errors.name = "Enter the customer's name.";

    if (!form.nic.trim()) {
        errors.nic = "Enter the NIC number.";
    } else if (!NIC_PATTERN.test(form.nic.trim())) {
        errors.nic = "Use 9 digits and V/X, or 12 digits.";
    }

    if (!form.chequeNo.trim()) errors.chequeNo = "Enter the cheque number.";
    if (!form.dateIssued) errors.dateIssued = "Choose the date issued.";

    const written = Number(form.writtenAmount);
    if (!form.writtenAmount || !Number.isFinite(written) || written <= 0) {
        errors.writtenAmount = "Enter an amount greater than zero.";
    }

    if (!form.passingDate) {
        errors.passingDate = "Choose the passing date.";
    } else if (form.dateIssued && form.passingDate < form.dateIssued) {
        errors.passingDate = "Passing date can't be before the date issued.";
    }

    return errors;
}

/* ------------------------------------------------------------------ */
/*  Data layer — replace the bodies of these two with Firebase         */
/* ------------------------------------------------------------------ */

/*
    Expected record shape (one document per cheque):

    {
        id, option,               // "option1" | "option2"
        name, nic, chequeNo,
        dateIssued, passingDate,  // "YYYY-MM-DD"
        writtenAmount, amountExchanged, amountWithheld,
        createdAt
    }
*/

async function fetchRecords() {
    // TODO (Firebase): read the "cashing" collection and return an array of
    // records, e.g.
    //   const snap = await getDocs(query(collection(db, "cashing"), orderBy("createdAt", "desc")));
    //   return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return [];
}

async function saveRecord(record) {
    // TODO (Firebase): write the record, e.g.
    //   const ref = await addDoc(collection(db, "cashing"), record);
    //   return { ...record, id: ref.id };
    return {
        ...record,
        id:
            typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),
    };
}

/* ------------------------------------------------------------------ */
/*  Small presentational pieces                                        */
/* ------------------------------------------------------------------ */

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

function SurfaceDecor() {
    return (
        <div className="cashing-surface__bg" aria-hidden="true">
            <div className="cashing-surface__glow" />
            {[1, 2, 3, 4, 5, 6].map((number) => (
                <span
                    key={number}
                    className={`cashing-surface__stripe cashing-surface__stripe--${number}`}
                />
            ))}
        </div>
    );
}

function Field({ id, label, error, hint, children }) {
    return (
        <div className="cashing-field">
            <label htmlFor={id}>{label}</label>
            {children}
            {error ? (
                <span className="cashing-field__error" role="alert">
                    {error}
                </span>
            ) : hint ? (
                <span className="cashing-field__hint">{hint}</span>
            ) : null}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Option form (used by both Option 1 and Option 2)                   */
/* ------------------------------------------------------------------ */

function CashingForm({
    optionId,
    form,
    errors,
    saving,
    notice,
    onChange,
    onSubmit,
    onReset,
}) {
    const { withheld, exchanged } = calculate(form.writtenAmount, optionId);
    const ratePercent = (WITHHOLD_RATE[optionId] ?? 0) * 100;
    const fid = (name) => `${optionId}-${name}`;
    const inputClass = (name) =>
        `cashing-input${errors[name] ? " is-invalid" : ""}`;

    return (
        <form className="cashing-form" onSubmit={onSubmit} noValidate>
            <div className="cashing-form__grid">
                <Field id={fid("name")} label="Name" error={errors.name}>
                    <input
                        id={fid("name")}
                        className={inputClass("name")}
                        type="text"
                        value={form.name}
                        onChange={(e) => onChange("name", e.target.value)}
                        placeholder="Customer name"
                        autoComplete="off"
                        aria-invalid={!!errors.name}
                    />
                </Field>

                <Field id={fid("nic")} label="NIC" error={errors.nic}>
                    <input
                        id={fid("nic")}
                        className={inputClass("nic")}
                        type="text"
                        value={form.nic}
                        onChange={(e) =>
                            onChange("nic", e.target.value.toUpperCase())
                        }
                        placeholder="e.g. 199012345678"
                        autoComplete="off"
                        maxLength={12}
                        aria-invalid={!!errors.nic}
                    />
                </Field>

                <Field
                    id={fid("chequeNo")}
                    label="Cheque number"
                    error={errors.chequeNo}
                >
                    <input
                        id={fid("chequeNo")}
                        className={inputClass("chequeNo")}
                        type="text"
                        inputMode="numeric"
                        value={form.chequeNo}
                        onChange={(e) => onChange("chequeNo", e.target.value)}
                        placeholder="Cheque number"
                        autoComplete="off"
                        aria-invalid={!!errors.chequeNo}
                    />
                </Field>

                <Field
                    id={fid("dateIssued")}
                    label="Date issued"
                    error={errors.dateIssued}
                >
                    <input
                        id={fid("dateIssued")}
                        className={inputClass("dateIssued")}
                        type="date"
                        value={form.dateIssued}
                        onChange={(e) => onChange("dateIssued", e.target.value)}
                        aria-invalid={!!errors.dateIssued}
                    />
                </Field>

                <Field
                    id={fid("writtenAmount")}
                    label="Written amount"
                    error={errors.writtenAmount}
                    hint={`${ratePercent}% of this amount is withheld.`}
                >
                    <input
                        id={fid("writtenAmount")}
                        className={inputClass("writtenAmount")}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={form.writtenAmount}
                        onChange={(e) =>
                            onChange("writtenAmount", e.target.value)
                        }
                        placeholder="0.00"
                        aria-invalid={!!errors.writtenAmount}
                    />
                </Field>

                <Field
                    id={fid("passingDate")}
                    label="Passing date"
                    error={errors.passingDate}
                >
                    <input
                        id={fid("passingDate")}
                        className={inputClass("passingDate")}
                        type="date"
                        min={form.dateIssued || undefined}
                        value={form.passingDate}
                        onChange={(e) => onChange("passingDate", e.target.value)}
                        aria-invalid={!!errors.passingDate}
                    />
                </Field>

                <Field
                    id={fid("exchanged")}
                    label="Amount exchanged"
                    hint="Written amount minus the amount withheld."
                >
                    <input
                        id={fid("exchanged")}
                        className="cashing-input cashing-input--calc"
                        type="text"
                        value={money(exchanged)}
                        readOnly
                        tabIndex={-1}
                    />
                </Field>

                <Field
                    id={fid("withheld")}
                    label="Amount withheld"
                    hint={`${ratePercent}% of the written amount.`}
                >
                    <input
                        id={fid("withheld")}
                        className="cashing-input cashing-input--calc"
                        type="text"
                        value={money(withheld)}
                        readOnly
                        tabIndex={-1}
                    />
                </Field>
            </div>

            <div className="cashing-calc" aria-live="polite">
                <div>
                    <span>Written amount</span>
                    <strong>{money(form.writtenAmount)}</strong>
                </div>
                <div>
                    <span>Amount exchanged</span>
                    <strong>{money(exchanged)}</strong>
                </div>
                <div>
                    <span>Amount withheld</span>
                    <strong>{money(withheld)}</strong>
                </div>
            </div>

            {notice && (
                <div
                    className="cashing-notice cashing-form__notice"
                    role="status"
                >
                    {notice}
                </div>
            )}

            <div className="cashing-form__actions">
                <button
                    type="submit"
                    className="cashing-btn cashing-btn--light"
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <span
                                className="cashing-spinner"
                                aria-hidden="true"
                            />
                            Saving
                        </>
                    ) : (
                        "Save cheque"
                    )}
                </button>

                <button
                    type="button"
                    className="cashing-btn cashing-btn--ghost"
                    onClick={onReset}
                    disabled={saving}
                >
                    Clear form
                </button>
            </div>
        </form>
    );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CashingPage() {
    const [activeTab, setActiveTab] = useState(TABS[0].id);
    const [today, setToday] = useState("");

    const [forms, setForms] = useState(initialForms);
    const [errors, setErrors] = useState({});
    const [notices, setNotices] = useState({});
    const [savingOption, setSavingOption] = useState(null);

    const [records, setRecords] = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(true);
    const [recordsError, setRecordsError] = useState("");
    const [search, setSearch] = useState("");

    const tabRefs = useRef({});
    const tabsScrollRef = useRef(null);
    const tabsDrag = useRef(null);
    const suppressTabClick = useRef(false);
    const firstTabsScroll = useRef(true);
    const [bannerOpen, setBannerOpen] = useState(false);
    const heroRef = useRef(null);
    const settingsRef = useRef(null);
    const collapseTimer = useRef(null);
    const wasOpen = useRef(false);

    const [indicator, setIndicator] = useState({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        ready: false,
    });

    useEffect(() => {
        setToday(
            new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            })
        );
    }, []);

    /* ---- Records ---- */

    const refreshRecords = async () => {
        setRecordsLoading(true);
        setRecordsError("");

        try {
            const data = await fetchRecords();
            setRecords(Array.isArray(data) ? data : []);
        } catch (error) {
            setRecordsError(error.message || "Could not load the records.");
        } finally {
            setRecordsLoading(false);
        }
    };

    useEffect(() => {
        refreshRecords();
    }, []);

    /* ---- Banner ---- */

    const clearCollapseTimer = () => {
        if (collapseTimer.current) {
            clearTimeout(collapseTimer.current);
            collapseTimer.current = null;
        }
    };

    const closeBanner = (delay = 0) => {
        clearCollapseTimer();

        if (delay > 0) {
            collapseTimer.current = setTimeout(
                () => setBannerOpen(false),
                delay
            );
        } else {
            setBannerOpen(false);
        }
    };

    const toggleBanner = () => {
        clearCollapseTimer();
        setBannerOpen((open) => !open);
    };

    useEffect(() => () => clearTimeout(collapseTimer.current), []);

    useEffect(() => {
        if (!bannerOpen) return;

        const onKeyDown = (event) => {
            if (event.key === "Escape") setBannerOpen(false);
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [bannerOpen]);

    useEffect(() => {
        if (bannerOpen) {
            tabRefs.current[activeTab]?.focus({ preventScroll: true });
        } else if (
            wasOpen.current &&
            heroRef.current?.contains(document.activeElement)
        ) {
            settingsRef.current?.focus({ preventScroll: true });
        }

        wasOpen.current = bannerOpen;
    }, [bannerOpen, activeTab]);

    useLayoutEffect(() => {
        const measure = () => {
            const element = tabRefs.current[activeTab];
            if (!element) return;

            setIndicator({
                left: element.offsetLeft,
                top: element.offsetTop,
                width: element.offsetWidth,
                height: element.offsetHeight,
                ready: true,
            });
        };

        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [activeTab]);

    /* ---- Scrollable tab bar: edge fades, centring and mouse drag ---- */

    const updateTabsEdges = () => {
        const el = tabsScrollRef.current;
        if (!el) return;

        const max = el.scrollWidth - el.clientWidth;
        el.dataset.scrollStart = el.scrollLeft <= 1 ? "true" : "false";
        el.dataset.scrollEnd =
            max <= 1 || el.scrollLeft >= max - 1 ? "true" : "false";
    };

    useLayoutEffect(() => {
        const scroller = tabsScrollRef.current;
        const element = tabRefs.current[activeTab];

        if (scroller && element) {
            const reduce = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;
            const left =
                element.offsetLeft -
                (scroller.clientWidth - element.offsetWidth) / 2;

            scroller.scrollTo({
                left: Math.max(0, left),
                behavior:
                    reduce || firstTabsScroll.current ? "auto" : "smooth",
            });
            firstTabsScroll.current = false;
        }

        updateTabsEdges();
    }, [activeTab, bannerOpen]);

    useEffect(() => {
        window.addEventListener("resize", updateTabsEdges);
        return () => window.removeEventListener("resize", updateTabsEdges);
    }, []);

    const handleTabsPointerDown = (event) => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;

        const el = tabsScrollRef.current;
        if (!el || el.scrollWidth <= el.clientWidth) return;

        tabsDrag.current = {
            startX: event.clientX,
            startLeft: el.scrollLeft,
            moved: false,
        };
    };

    const handleTabsPointerMove = (event) => {
        const drag = tabsDrag.current;
        const el = tabsScrollRef.current;
        if (!drag || !el) return;

        const dx = event.clientX - drag.startX;

        if (!drag.moved && Math.abs(dx) > 5) {
            drag.moved = true;
            el.classList.add("is-dragging");
            el.setPointerCapture?.(event.pointerId);
        }

        if (drag.moved) el.scrollLeft = drag.startLeft - dx;
    };

    const endTabsDrag = (event) => {
        const drag = tabsDrag.current;
        const el = tabsScrollRef.current;
        if (!drag) return;

        tabsDrag.current = null;
        el?.classList.remove("is-dragging");
        if (el?.hasPointerCapture?.(event.pointerId)) {
            el.releasePointerCapture(event.pointerId);
        }

        if (drag.moved) {
            suppressTabClick.current = true;
            setTimeout(() => {
                suppressTabClick.current = false;
            }, 0);
        }
    };

    const selectTab = (id, collapse = false) => {
        setActiveTab(id);
        setErrors({});

        if (collapse) closeBanner(420);
    };

    const handleTabKeyDown = (event) => {
        const index = TABS.findIndex((tab) => tab.id === activeTab);
        let next = null;

        if (event.key === "ArrowRight") {
            next = (index + 1) % TABS.length;
        } else if (event.key === "ArrowLeft") {
            next = (index - 1 + TABS.length) % TABS.length;
        } else if (event.key === "Home") {
            next = 0;
        } else if (event.key === "End") {
            next = TABS.length - 1;
        }

        if (next === null) return;

        event.preventDefault();
        selectTab(TABS[next].id);
        tabRefs.current[TABS[next].id]?.focus({ preventScroll: true });
    };

    /* ---- Form handlers ---- */

    const updateField = (optionId, field, value) => {
        setForms((previous) => ({
            ...previous,
            [optionId]: { ...previous[optionId], [field]: value },
        }));

        setErrors((previous) =>
            previous[field] ? { ...previous, [field]: undefined } : previous
        );

        setNotices((previous) =>
            previous[optionId] ? { ...previous, [optionId]: "" } : previous
        );
    };

    const resetForm = (optionId) => {
        setForms((previous) => ({
            ...previous,
            [optionId]: { ...emptyForm },
        }));
        setErrors({});
        setNotices((previous) => ({ ...previous, [optionId]: "" }));
    };

    const submitForm = async (event, optionId) => {
        event.preventDefault();
        if (savingOption) return;

        const form = forms[optionId];
        const found = validate(form);

        if (Object.keys(found).length > 0) {
            setErrors(found);
            return;
        }

        setErrors({});
        setSavingOption(optionId);

        const { withheld, exchanged } = calculate(form.writtenAmount, optionId);

        const record = {
            option: optionId,
            name: form.name.trim(),
            nic: form.nic.trim(),
            chequeNo: form.chequeNo.trim(),
            dateIssued: form.dateIssued,
            passingDate: form.passingDate,
            writtenAmount: Number(form.writtenAmount),
            amountExchanged: exchanged,
            amountWithheld: withheld,
            createdAt: new Date().toISOString(),
        };

        try {
            const saved = await saveRecord(record);

            setRecords((previous) => [saved, ...previous]);
            setForms((previous) => ({
                ...previous,
                [optionId]: { ...emptyForm },
            }));
            setNotices((previous) => ({
                ...previous,
                [optionId]:
                    `Cheque ${record.chequeNo} saved for ${record.name}.\n` +
                    `Exchanged ${money(exchanged)} · Withheld ${money(withheld)}`,
            }));
        } catch (error) {
            setNotices((previous) => ({
                ...previous,
                [optionId]: error.message || "Could not save the cheque.",
            }));
        } finally {
            setSavingOption(null);
        }
    };

    /* ---- Derived data ---- */

    const tab = TABS.find((item) => item.id === activeTab);
    const isView = activeTab === "view";

    const visibleRecords = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return records;

        return records.filter((record) =>
            VIEW_COLUMNS.map((c) => c.text(record) ?? "")
                .join(" ")
                .toLowerCase()
                .includes(term)
        );
    }, [records, search]);

    const totals = useMemo(
        () =>
            visibleRecords.reduce(
                (sum, record) => ({
                    written: sum.written + Number(record.writtenAmount || 0),
                    exchanged:
                        sum.exchanged + Number(record.amountExchanged || 0),
                    withheld: sum.withheld + Number(record.amountWithheld || 0),
                }),
                { written: 0, exchanged: 0, withheld: 0 }
            ),
        [visibleRecords]
    );

    return (
        <main className="min-h-screen bg-[#171717]">
            <div className="home-navbar-fixed">
                <Navbar />
            </div>

            <div className="home-page cashing-page">
                <div
                    className={`cashing-scrim${bannerOpen ? " is-visible" : ""}`}
                    onClick={() => closeBanner()}
                    aria-hidden="true"
                />

                <section
                    ref={heroRef}
                    className={`home-hero cashing-hero ${bannerOpen ? "is-open" : "is-collapsed"
                        }`}
                >
                    <div className="home-hero__glow" />

                    <div className="home-hero__stripes">
                        {Array.from({ length: 12 }).map((_, index) => (
                            <span
                                key={index}
                                className={`home-hero__stripe home-hero__stripe--${index + 1}`}
                            />
                        ))}
                    </div>

                    <div
                        className="cashing-hero__content"
                        id="cashing-hero-panel"
                    >
                        <div className="cashing-hero__top">
                            <div className="cashing-hero__heading">
                                <h1 className="cashing-hero__title">CASHING</h1>
                                <span className="cashing-hero__meta">
                                    {today}
                                </span>
                            </div>

                            <button
                                type="button"
                                className="cashing-hero__btn cashing-hero__btn--icon"
                                onClick={() => closeBanner()}
                                aria-label="Roll up banner"
                                title="Roll up"
                            >
                                <ChevronUp size={18} strokeWidth={2.3} />
                            </button>
                        </div>

                        <div className="cashing-tabs">
                            <div
                                ref={tabsScrollRef}
                                className="cashing-tabs__scroll"
                                role="tablist"
                                aria-label="Cashing sections"
                                onKeyDown={handleTabKeyDown}
                                onScroll={updateTabsEdges}
                                onPointerDown={handleTabsPointerDown}
                                onPointerMove={handleTabsPointerMove}
                                onPointerUp={endTabsDrag}
                                onPointerCancel={endTabsDrag}
                                onPointerLeave={endTabsDrag}
                            >
                                <span
                                    className={`cashing-tabs__indicator${indicator.ready ? " is-ready" : ""
                                        }`}
                                    style={{
                                        width: indicator.width,
                                        height: indicator.height,
                                        transform: `translate(${indicator.left}px, ${indicator.top}px)`,
                                    }}
                                    aria-hidden="true"
                                />

                                {TABS.map((item) => (
                                    <button
                                        key={item.id}
                                        ref={(element) => {
                                            tabRefs.current[item.id] = element;
                                        }}
                                        type="button"
                                        role="tab"
                                        id={`tab-${item.id}`}
                                        aria-selected={activeTab === item.id}
                                        aria-controls="cashing-panel"
                                        tabIndex={activeTab === item.id ? 0 : -1}
                                        className={`cashing-tabs__btn${activeTab === item.id ? " is-active" : ""
                                            }`}
                                        onClick={() => {
                                            if (suppressTabClick.current) return;
                                            selectTab(item.id, true);
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="cashing-hero__bar">
                        <h1 className="cashing-hero__bar-title">CASHING</h1>

                        <span
                            key={activeTab}
                            className="cashing-hero__bar-tab"
                            aria-live="polite"
                        >
                            {tab.label}
                        </span>

                        <button
                            ref={settingsRef}
                            type="button"
                            className="cashing-hero__settings"
                            onClick={toggleBanner}
                            aria-label="Open cashing sections"
                            aria-expanded={bannerOpen}
                            aria-controls="cashing-hero-panel"
                            title="Settings"
                        >
                            <CogIcon size={20} />
                        </button>
                    </div>
                </section>

                <section className="cashing-content">
                    <div className="cashing-surface">
                        <SurfaceDecor />

                        <header className="cashing-header">
                            <h2>{isView ? "All cheques" : `${tab.label} cheque`}</h2>
                            <p>
                                {isView
                                    ? "Every cheque recorded under Option 1 and Option 2."
                                    : "Fill in the cheque details. The exchanged and withheld amounts are worked out from the written amount."}
                            </p>
                        </header>

                        <div
                            key={activeTab}
                            id="cashing-panel"
                            className="cashing-panel"
                            role="tabpanel"
                            aria-labelledby={`tab-${activeTab}`}
                        >
                            {!isView ? (
                                <section className="cashing-section cashing-section--last">
                                    <div className="cashing-section__intro">
                                        <h3>Cheque details</h3>
                                        <p>
                                            {(WITHHOLD_RATE[activeTab] ?? 0) * 100}% of
                                            the written amount is withheld; the rest
                                            is exchanged.
                                        </p>
                                    </div>

                                    <div className="cashing-section__body">
                                        <CashingForm
                                            optionId={activeTab}
                                            form={forms[activeTab]}
                                            errors={errors}
                                            saving={savingOption === activeTab}
                                            notice={notices[activeTab]}
                                            onChange={(field, value) =>
                                                updateField(activeTab, field, value)
                                            }
                                            onSubmit={(event) =>
                                                submitForm(event, activeTab)
                                            }
                                            onReset={() => resetForm(activeTab)}
                                        />
                                    </div>
                                </section>
                            ) : (
                                <section className="cashing-view">
                                    <div className="home-card__head cashing-view__head">
                                        <div>
                                            <h2>
                                                Cheque Records{" "}
                                                <span className="cashing-count">
                                                    {recordsLoading ? "…" : visibleRecords.length}
                                                </span>
                                            </h2>
                                            <p>
                                                Every cheque saved under Option 1 and Option 2,
                                                with its exchanged and withheld amounts.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            className="cashing-btn cashing-btn--light cashing-refresh"
                                            onClick={refreshRecords}
                                            disabled={recordsLoading}
                                        >
                                            {recordsLoading ? (
                                                <>
                                                    <span
                                                        className="cashing-spinner"
                                                        aria-hidden="true"
                                                    />
                                                    Refreshing
                                                </>
                                            ) : (
                                                "Refresh"
                                            )}
                                        </button>
                                    </div>

                                    <div className="home-search">
                                        <Search
                                            size={16}
                                            className="home-search__icon"
                                            aria-hidden="true"
                                        />
                                        <input
                                            type="search"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search cheques"
                                            aria-label="Search cheques"
                                            autoComplete="off"
                                        />
                                    </div>

                                    <div className="home-table-wrap">
                                        <table className="home-table cashing-table">
                                            <thead>
                                                <tr>
                                                    {VIEW_COLUMNS.map((c) => (
                                                        <th
                                                            key={c.key}
                                                            className={c.num ? "is-num" : undefined}
                                                        >
                                                            {c.label}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {visibleRecords.map((record, index) => (
                                                    <tr key={record.id ?? index}>
                                                        {VIEW_COLUMNS.map((c) => {
                                                            const value = c.text(record) || "-";

                                                            return (
                                                                <td
                                                                    key={c.key}
                                                                    className={c.num ? "is-num" : undefined}
                                                                >
                                                                    {c.badge ? (
                                                                        <span className="home-badge">
                                                                            {value}
                                                                        </span>
                                                                    ) : (
                                                                        value
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>

                                            {visibleRecords.length > 0 && (
                                                <tfoot>
                                                    <tr>
                                                        <td colSpan={5}>Total</td>
                                                        <td className="is-num">{money(totals.written)}</td>
                                                        <td />
                                                        <td className="is-num">{money(totals.exchanged)}</td>
                                                        <td className="is-num">{money(totals.withheld)}</td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>

                                        {recordsLoading ? (
                                            <p className="home-empty">Loading records...</p>
                                        ) : recordsError ? (
                                            <p className="home-empty">{recordsError}</p>
                                        ) : records.length === 0 ? (
                                            <p className="home-empty">
                                                No cheques recorded yet. Add one under Option 1 or Option 2.
                                            </p>
                                        ) : visibleRecords.length === 0 ? (
                                            <p className="home-empty">
                                                No cheques match your search. Clear it to see all records.
                                            </p>
                                        ) : null}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}