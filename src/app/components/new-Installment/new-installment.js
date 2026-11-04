"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import "../../styles/new-installment/new-installment.css";

/* ------------------------------------------------------------------
   Config
------------------------------------------------------------------ */

const PLAN_RULES = {
    D: { unit: "Days", single: "day", max: 60 },
    W: { unit: "Weeks", single: "week", max: 54 },
    M: { unit: "Months", single: "month", max: 12 },
    MINT: { unit: "Months", single: "month", max: 11 },
    C: { unit: "Days", single: "day", max: null },
};

/* ------------------------------------------------------------------
   Customer API
------------------------------------------------------------------ */

const REG_PATTERN = /^(MINT|D|M|W|C)-?(\d+)$/;

const REGISTRATION_FIELDS = {
    D: "dailyRegNo",
    W: "weeklyRegNo",
    M: "monthlyRegNo",
    MINT: "MintRegNo",
    C: "chqRegNo",
};

function normalizeRegistrationNo(value) {
    const match = REG_PATTERN.exec(
        String(value ?? "").trim().toUpperCase()
    );

    if (!match) return "";

    return `${match[1]}-${match[2]}`;
}

function getCustomer(customers, registrationNo) {
    const normalized = normalizeRegistrationNo(registrationNo);
    const match = REG_PATTERN.exec(normalized);

    if (!match) return null;

    const prefix = match[1];
    const field = REGISTRATION_FIELDS[prefix];

    const customer = customers.find(
        (item) =>
            normalizeRegistrationNo(item[field]) === normalized
    );

    if (!customer) return null;

    return {
        ...customer,
        registrationNo: normalized,
        prefix,
        name: customer.fullName ?? "",
        address: customer.permanentAddress ?? "",
        nic: customer.nic ?? "",
        contact: customer.contact ?? "",
    };
}

/* ------------------------------------------------------------------
   Business rules
------------------------------------------------------------------ */

// Selectable monthly interest rates for Weekly, Monthly and MINT.
const SELECTABLE_INTEREST_RATES = [5, 6, 7, 8, 9, 10];

// Daily interest rates are monthly rates.
function getDailyInterestRate(days) {
    if (!Number.isInteger(days) || days < 1) return null;

    if (days >= 60) return 10;
    if (days === 59) return 9;
    if (days === 58) return 8;
    if (days === 57) return 7;
    if (days === 56) return 6;

    return 5;
}

// Convert loan duration into monthly interest periods.
// Partial months are rounded up.
function getInterestPeriods(prefix, plan) {
    if (!Number.isInteger(plan) || plan < 1) return 0;

    switch (prefix) {
        case "D":
        case "C":
            return Math.ceil(plan / 30);

        case "W":
            return Math.ceil((plan * 7) / 30);

        case "M":
        case "MINT":
            return plan;

        default:
            return 0;
    }
}

const round2 = (n) =>
    Math.round((n + Number.EPSILON) * 100) / 100;

const money = (n) =>
    n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso) {
    if (!iso) return "";

    const [y, m, d] = iso.split("-").map(Number);

    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

/* ------------------------------------------------------------------
   Small pieces
------------------------------------------------------------------ */

function useReveal(rootRef) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const els = root.querySelectorAll("[data-nl-reveal]");

        if (typeof IntersectionObserver === "undefined") {
            els.forEach((el) => el.classList.add("is-in"));
            return;
        }

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-in");
                        io.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -40px 0px",
            }
        );

        els.forEach((el) => io.observe(el));

        return () => io.disconnect();
    }, [rootRef]);
}

function Section({ title, description, children }) {
    return (
        <section className="newfund-section" data-nl-reveal>
            <div className="newfund-section__intro">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>

            <div className="newfund-section__fields">
                {children}
            </div>
        </section>
    );
}

function Field({
    id,
    label,
    i = 0,
    wide = false,
    auto = false,
    hint,
    children,
}) {
    return (
        <div
            className={`newfund-field${wide ? " newfund-field--wide" : ""}`}
            style={{ "--i": i }}
        >
            <label htmlFor={id}>
                {label}{" "}
                {auto ? (
                    <em>auto</em>
                ) : (
                    <span aria-hidden="true">*</span>
                )}
            </label>

            {children}

            {hint && <small>{hint}</small>}
        </div>
    );
}

/* ------------------------------------------------------------------
   Form
------------------------------------------------------------------ */

export default function NewInstallment({ onClose, onSubmit }) {
    const [registrationNo, setRegistrationNo] = useState("");
    const [urgencyFund, setUrgencyFund] = useState("");
    const [plan, setPlan] = useState("");
    const [selectedInterestRate, setSelectedInterestRate] = useState("10");
    const [dateOfFund, setDateOfFund] = useState("");

    const [customers, setCustomers] = useState([]);
    const [customersLoading, setCustomersLoading] = useState(true);
    const [customersError, setCustomersError] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const rootRef = useRef(null);

    useReveal(rootRef);

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    useEffect(() => {
        setDateOfFund(todayISO());
    }, []);

    /* ---------- Load customers ---------- */

    useEffect(() => {
        let cancelled = false;

        async function loadCustomers() {
            try {
                setCustomersLoading(true);
                setCustomersError("");

                const response = await fetch("/api/customers/get", {
                    cache: "no-store",
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result.error || "Failed to load customers."
                    );
                }

                if (!cancelled) {
                    setCustomers(
                        Array.isArray(result.customers)
                            ? result.customers
                            : []
                    );
                }
            } catch (error) {
                if (!cancelled) {
                    setCustomersError(
                        error.message || "Failed to load customers."
                    );
                }
            } finally {
                if (!cancelled) {
                    setCustomersLoading(false);
                }
            }
        }

        loadCustomers();

        return () => {
            cancelled = true;
        };
    }, []);

    /* ---------- Derived values ---------- */

    const customer = useMemo(
        () => getCustomer(customers, registrationNo),
        [customers, registrationNo]
    );

    const prefix = customer?.prefix ?? "";
    const rule = PLAN_RULES[prefix];
    const maxPlan = rule?.max ?? null;

    const urgency = parseFloat(urgencyFund) || 0;
    const planNum = parseInt(plan, 10) || 0;

    // All rates are monthly interest rates.
    const interestRate =
        prefix === "D"
            ? getDailyInterestRate(planNum)
            : prefix === "W" ||
                prefix === "M" ||
                prefix === "MINT"
                ? Number(selectedInterestRate)
                : prefix === "C"
                    ? 10
                    : null;

    // Number of monthly interest periods in the loan duration.
    const interestPeriods = getInterestPeriods(prefix, planNum);

    // Interest for one monthly period.
    const monthlyInterestAmount =
        interestRate !== null && urgency > 0
            ? round2((urgency * interestRate) / 100)
            : null;

    // Total accumulated interest across the full loan duration.
    const interestAmount =
        monthlyInterestAmount !== null && interestPeriods > 0
            ? round2(monthlyInterestAmount * interestPeriods)
            : null;

    // Installment calculation.
    let installment = null;

    if (
        monthlyInterestAmount !== null &&
        urgency > 0 &&
        planNum > 0
    ) {
        if (prefix === "MINT") {
            // MINT collects monthly interest only.
            // Principal is paid separately at settlement.
            installment = monthlyInterestAmount;
        } else if (interestAmount !== null) {
            installment = round2(
                (urgency + interestAmount) / planNum
            );
        }
    }

    // MINT does not include principal in its regular monthly payment.
    const totalPayable =
        prefix !== "MINT" && interestAmount !== null
            ? round2(urgency + interestAmount)
            : null;

    const isValid = Boolean(
        customer &&
        urgency > 0 &&
        planNum >= 1 &&
        interestRate !== null &&
        interestPeriods > 0 &&
        installment !== null
    );

    /* ---------- Handlers ---------- */

    const handleRegistration = (e) => {
        const value = e.target.value
            .toUpperCase()
            .replace(/[^A-Z0-9-]/g, "");

        setRegistrationNo(value);

        const next = getCustomer(customers, value);
        const limit = next ? PLAN_RULES[next.prefix]?.max : null;

        if (limit && parseInt(plan, 10) > limit) {
            setPlan(String(limit));
        }
    };

    const handleUrgency = (e) => {
        let value = e.target.value.replace(/[^0-9.]/g, "");

        const [whole, ...rest] = value.split(".");

        value = rest.length
            ? `${whole}.${rest.join("").slice(0, 2)}`
            : whole;

        setUrgencyFund(value);
    };

    const handlePlan = (e) => {
        let value = e.target.value
            .replace(/\D/g, "")
            .replace(/^0+/, "");

        if (maxPlan && parseInt(value, 10) > maxPlan) {
            value = String(maxPlan);
        }

        setPlan(value);
    };

    const handleInterestRate = (e) => {
        setSelectedInterestRate(e.target.value);
    };

    const handleReset = () => {
        setRegistrationNo("");
        setUrgencyFund("");
        setPlan("");
        setSelectedInterestRate("10");
    };

    /* ---------- Submit ---------- */

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!isValid || submitting) return;

        setSubmitError("");
        setSubmitting(true);

        const finalData = {
            registrationNo: customer.registrationNo,
            prefix: customer.prefix,
            customerNic: customer.nic,
            name: customer.name,
            address: customer.address,
            contact: customer.contact,

            urgencyFund: urgency,
            plan: planNum,
            planUnit: rule.unit.toLowerCase(),

            interestRate,
            interestPeriods,
            monthlyInterestAmount,
            interestAmount,

            installment,
            totalPayable,

            dateOfFund,
        };

        try {
            const response = await fetch("/api/installments/add", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(finalData),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "Failed to create installment."
                );
            }

            if (onSubmit) {
                onSubmit(result.installment ?? finalData);
            }
        } catch (error) {
            setSubmitError(
                error.message || "Failed to create installment."
            );
        } finally {
            setSubmitting(false);
        }
    };

    /* ---------- Progress ---------- */

    const values = [
        customer ? registrationNo : "",
        customer?.name,
        customer?.address,
        customer?.nic,
        customer?.contact,
        urgencyFund,
        plan,
        interestRate !== null ? "x" : "",
        installment !== null ? "x" : "",
        dateOfFund,
    ];

    const total = values.length;

    const done = values.filter(
        (v) => v && String(v).trim() !== ""
    ).length;

    /* ---------- Hints ---------- */

    let regHint = "Enter a customer's registration number";

    if (registrationNo) {
        regHint = customer ? (
            <span className="newfund-status newfund-status--ok">
                <CheckCircle2 size={14} aria-hidden="true" />
                Customer found
            </span>
        ) : (
            <span className="newfund-status newfund-status--err">
                <AlertCircle size={14} aria-hidden="true" />
                No customer found for this registration number
            </span>
        );
    }

    let planHint = "Select a customer first";

    if (customer) {
        planHint = maxPlan
            ? `Maximum ${maxPlan} ${rule.unit.toLowerCase()}`
            : `Enter number of ${rule.unit.toLowerCase()}`;
    }

    let interestHint = "Select the monthly interest rate";

    if (
        interestRate !== null &&
        monthlyInterestAmount !== null
    ) {
        interestHint =
            `${interestRate}% per month × ${interestPeriods} periods = ` +
            `LKR ${money(interestAmount ?? 0)} total interest`;
    }

    let installmentHint = "Fill in the urgency fund and plan";

    if (installment !== null) {
        installmentHint =
            prefix === "MINT"
                ? `Monthly interest only: LKR ${money(monthlyInterestAmount ?? 0)}. Principal is due at settlement.`
                : `Total payable (${money(totalPayable ?? 0)}) ÷ ${planNum} ${rule.unit.toLowerCase()} installments`;
    }

    const readOnlyProps = {
        readOnly: true,
        tabIndex: -1,
    };

    /* ---------- Render ---------- */

    return (
        <div className="newfund-panel" ref={rootRef}>
            <div className="newfund-card">

                {/* Background */}
                <div className="newfund-bg" aria-hidden="true">
                    <div className="newfund-bg__glow" />
                    <span className="newfund-stripe newfund-stripe--1" />
                    <span className="newfund-stripe newfund-stripe--2" />
                    <span className="newfund-stripe newfund-stripe--3" />
                    <span className="newfund-stripe newfund-stripe--4" />
                    <span className="newfund-stripe newfund-stripe--5" />
                    <span className="newfund-stripe newfund-stripe--6" />
                </div>

                <header className="newfund-header">
                    <div>
                        <h2>Set up new installment</h2>
                        <p>
                            Pick the customer, then set the fund amount and plan.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="newfund-close"
                        onClick={onClose}
                        aria-label="Close fund approval form"
                    >
                        <X size={18} strokeWidth={2.2} />
                    </button>
                </header>

                <form className="newfund-form" onSubmit={handleSubmit}>

                    {/* Customer section */}
                    <Section
                        title="Customer"
                        description="Enter the registration number and the customer's details fill in by themselves."
                    >
                        <Field
                            id="registrationNo"
                            label="Registration no."
                            i={0}
                            wide
                            hint={regHint}
                        >
                            <div className="newfund-group">
                                <div className="newfund-affix newfund-affix--start">
                                    {prefix || "\u2014"}
                                </div>

                                <input
                                    id="registrationNo"
                                    name="registrationNo"
                                    type="text"
                                    list="newfund-reg-list"
                                    autoComplete="off"
                                    placeholder="Enter registration number"
                                    value={registrationNo}
                                    onChange={handleRegistration}
                                    required
                                />
                            </div>

                            <datalist id="newfund-reg-list">
                                {customers.flatMap((item) =>
                                    Object.entries(REGISTRATION_FIELDS)
                                        .map(([prefix, field]) => {
                                            const value = normalizeRegistrationNo(
                                                item[field]
                                            );

                                            if (!value) return null;

                                            return (
                                                <option
                                                    key={`${item.nic}-${prefix}`}
                                                    value={value}
                                                />
                                            );
                                        })
                                        .filter(Boolean)
                                )}
                            </datalist>
                        </Field>

                        <Field
                            id="name"
                            label="Name"
                            i={1}
                            auto
                            wide
                        >
                            <input
                                id="name"
                                type="text"
                                value={customer?.name ?? ""}
                                placeholder="Filled from registration no."
                                {...readOnlyProps}
                            />
                        </Field>

                        <Field id="nic" label="NIC" i={2} auto>
                            <input
                                id="nic"
                                type="text"
                                value={customer?.nic ?? ""}
                                placeholder="Filled from registration no."
                                {...readOnlyProps}
                            />
                        </Field>

                        <Field
                            id="contact"
                            label="Contact no."
                            i={3}
                            auto
                        >
                            <input
                                id="contact"
                                type="tel"
                                value={customer?.contact ?? ""}
                                placeholder="Filled from registration no."
                                {...readOnlyProps}
                            />
                        </Field>

                        <Field
                            id="address"
                            label="Address"
                            i={4}
                            auto
                            wide
                        >
                            <textarea
                                id="address"
                                value={customer?.address ?? ""}
                                placeholder="Filled from registration no."
                                {...readOnlyProps}
                            />
                        </Field>
                    </Section>

                    {/* Fund section */}
                    <Section
                        title="Fund"
                        description="Interest and installment are worked out from the credit type, amount and plan."
                    >
                        <Field
                            id="urgencyFund"
                            label="Urgency fund"
                            i={0}
                            hint={
                                urgency > 0
                                    ? `LKR ${money(urgency)}`
                                    : "Amount to be given to the customer"
                            }
                        >
                            <div className="newfund-group">
                                <div className="newfund-affix newfund-affix--start">
                                    LKR
                                </div>

                                <input
                                    id="urgencyFund"
                                    name="urgencyFund"
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder="0.00"
                                    value={urgencyFund}
                                    onChange={handleUrgency}
                                    required
                                />
                            </div>
                        </Field>

                        <Field
                            id="plan"
                            label="Installment plan"
                            i={1}
                            hint={planHint}
                        >
                            <div className="newfund-group">
                                <input
                                    id="plan"
                                    name="plan"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder={
                                        customer
                                            ? "Enter number"
                                            : "Select customer first"
                                    }
                                    value={plan}
                                    onChange={handlePlan}
                                    disabled={!customer}
                                    required
                                />

                                <div className="newfund-affix newfund-affix--end">
                                    {rule?.unit ?? "\u2014"}
                                </div>
                            </div>
                        </Field>

                        {/* Monthly interest rate */}
                        <Field
                            id="interest"
                            label="Monthly interest rate"
                            i={2}
                            auto={prefix === "D"}
                            hint={interestHint}
                        >
                            {prefix === "W" ||
                                prefix === "M" ||
                                prefix === "MINT" ? (
                                <select
                                    id="interest"
                                    name="interestRate"
                                    value={selectedInterestRate}
                                    onChange={handleInterestRate}
                                    disabled={!customer}
                                    required
                                >
                                    {SELECTABLE_INTEREST_RATES.map((rate) => (
                                        <option
                                            key={rate}
                                            value={rate}
                                        >
                                            {rate}% per month
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    id="interest"
                                    type="text"
                                    value={
                                        interestRate !== null
                                            ? `${interestRate}% per month`
                                            : ""
                                    }
                                    placeholder="Auto"
                                    {...readOnlyProps}
                                />
                            )}
                        </Field>

                        {/* Installment */}
                        <Field
                            id="installment"
                            label={
                                prefix === "MINT"
                                    ? "Monthly interest"
                                    : "Installment"
                            }
                            i={3}
                            auto
                            hint={installmentHint}
                        >
                            <div className="newfund-group">
                                <div className="newfund-affix newfund-affix--start">
                                    LKR
                                </div>

                                <input
                                    id="installment"
                                    type="text"
                                    value={
                                        installment !== null
                                            ? money(installment)
                                            : ""
                                    }
                                    placeholder="Auto"
                                    {...readOnlyProps}
                                />
                            </div>
                        </Field>

                        {/* Date */}
                        <Field
                            id="dateOfFund"
                            label="Date of fund"
                            i={4}
                            auto
                            wide
                        >
                            <input
                                id="dateOfFund"
                                type="text"
                                value={formatDate(dateOfFund)}
                                {...readOnlyProps}
                            />
                        </Field>
                    </Section>

                    {/* Status messages */}
                    {customersLoading && (
                        <p role="status">Loading customers...</p>
                    )}

                    {customersError && (
                        <p role="alert">{customersError}</p>
                    )}

                    {submitError && (
                        <p role="alert">{submitError}</p>
                    )}

                    {/* Footer */}
                    <footer
                        className="newfund-footer"
                        data-nl-reveal
                    >
                        <div className="newfund-progress">
                            <span
                                className="newfund-progress__text"
                                aria-live="polite"
                            >
                                {done} of {total} fields complete
                            </span>

                            <div
                                className="newfund-progress__bar"
                                role="progressbar"
                                aria-label="Form completion"
                                aria-valuemin={0}
                                aria-valuemax={total}
                                aria-valuenow={done}
                            >
                                <span
                                    className="newfund-progress__fill"
                                    style={{
                                        width: `${(done / total) * 100}%`,
                                    }}
                                />
                            </div>
                        </div>

                        <div className="newfund-actions">
                            <button
                                type="button"
                                className="newfund-btn newfund-btn--ghost"
                                onClick={onClose}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="newfund-btn newfund-btn--ghost"
                                onClick={handleReset}
                            >
                                Clear
                            </button>

                            <button
                                type="submit"
                                className="newfund-btn newfund-btn--primary"
                                disabled={
                                    !isValid ||
                                    submitting ||
                                    customersLoading
                                }
                            >
                                {submitting ? "Saving..." : "Approve"}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    );
}