"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import "../../styles/customerRegistration/registration.css";

const creditTypes = [
    { label: "Daily Collect", prefix: "D" },
    { label: "Monthly Collect", prefix: "M" },
    { label: "Monthly Interest", prefix: "MINT" },
    { label: "Weekly Installment", prefix: "W" },
    { label: "Cheque Cashing", prefix: "CH" },
];

// Route that returns the next registration number
const AUTO_NUMBER_URL = "/api/auto-number/get";

/* ------------------------------------------------------------------
   Small pieces
------------------------------------------------------------------ */

// Reveals every [data-rd-reveal] element inside the form as it scrolls into view.
function useReveal(rootRef) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const els = root.querySelectorAll("[data-rd-reveal]");
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
            { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        );
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [rootRef]);
}

function Section({ title, description, children }) {
    return (
        <section className="regdebtor-section" data-rd-reveal>
            <div className="regdebtor-section__intro">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
            <div className="regdebtor-section__fields">{children}</div>
        </section>
    );
}

// i = position inside its section, used to stagger the fields in
function Field({ id, label, i = 0, wide = false, required = true, className = "", hint, children }) {
    return (
        <div
            className={`regdebtor-field${wide ? " regdebtor-field--wide" : ""}${className ? ` ${className}` : ""}`}
            style={{ "--i": i }}
        >
            <label htmlFor={id}>
                {label} {required && <span aria-hidden="true">*</span>}
            </label>
            {children}
            {hint && <small>{hint}</small>}
        </div>
    );
}

/* ------------------------------------------------------------------
   Form
------------------------------------------------------------------ */

export default function RegDebtor({ onClose, onSubmit }) {
    const [formData, setFormData] = useState({
        creditType: "",
        registrationNo: "",
        fullName: "",
        permanentAddress: "",
        nic: "",
        tele: "",
        businessType: "",
        businessAddress: "",
        businessRegistrationNo: "",
        loanPurpose: "",
        routeToHouse: "",
    });

    const [numberLoading, setNumberLoading] = useState(false);
    const [numberError, setNumberError] = useState("");

    const rootRef = useRef(null);
    const addBtnRef = useRef(null);
    const numberRequest = useRef(0);
    useReveal(rootRef);

    // The form replaces the table, so start from the top of the page
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);

    const prefix = creditTypes.find((t) => t.label === formData.creditType)?.prefix ?? "";

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "creditType") {
            // A different credit type means a different number: drop the old one
            // and ignore any request that is still in flight.
            numberRequest.current += 1;
            setNumberLoading(false);
            setNumberError("");
            setFormData((prev) => ({ ...prev, creditType: value, registrationNo: "" }));
            return;
        }

        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Ask the API for the next registration number
    const fetchRegistrationNo = async () => {
        if (!prefix || formData.registrationNo || numberLoading) return;

        const requestId = ++numberRequest.current;

        setNumberLoading(true);
        setNumberError("");

        try {
            const params = new URLSearchParams({ creditType: formData.creditType, prefix });
            const response = await fetch(`${AUTO_NUMBER_URL}?${params.toString()}`, {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: { Accept: "application/json" },
            });

            const data = await response.json().catch(() => ({}));

            // Credit type changed while waiting: ignore this response
            if (requestId !== numberRequest.current) return;

            if (!response.ok || !data.success || !data.registrationNo) {
                throw new Error(data.error || "Unable to fetch the registration number.");
            }

            setFormData((prev) => ({
                ...prev,
                registrationNo: String(data.registrationNo).trim().toUpperCase(),
            }));
        } catch (error) {
            if (requestId !== numberRequest.current) return;
            setNumberError(error.message || "Unable to fetch the registration number.");
        } finally {
            if (requestId === numberRequest.current) setNumberLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // The number field is read-only, so the browser's "required" check skips it
        if (!formData.registrationNo) {
            setNumberError("Add a registration number before registering the customer.");
            addBtnRef.current?.focus();
            return;
        }

        // The prefix is only an indicator; it is not part of the saved data
        if (onSubmit) onSubmit({ ...formData, prefix });
    };

    // idle: no credit type yet | missing: waiting for "+" | ready: number added
    const regState = formData.registrationNo ? "ready" : prefix ? "missing" : "idle";

    const props = (name) => ({ id: name, name, value: formData[name], onChange: handleChange, required: true });

    const total = Object.keys(formData).length;
    const done = Object.values(formData).filter((v) => v.trim() !== "").length;

    return (
        <div className="regdebtor-panel" ref={rootRef}>
            <div className="regdebtor-card">
                {/* Same look as the page hero */}
                <div className="regdebtor-bg" aria-hidden="true">
                    <div className="regdebtor-bg__glow" />
                    <span className="regdebtor-stripe regdebtor-stripe--1" />
                    <span className="regdebtor-stripe regdebtor-stripe--2" />
                    <span className="regdebtor-stripe regdebtor-stripe--3" />
                    <span className="regdebtor-stripe regdebtor-stripe--4" />
                    <span className="regdebtor-stripe regdebtor-stripe--5" />
                    <span className="regdebtor-stripe regdebtor-stripe--6" />
                </div>

                <header className="regdebtor-header">
                    <div>
                        <h2>Customer Registration</h2>
                        <p>Fill in the customer&apos;s details. All fields are required.</p>
                    </div>

                    <button type="button" className="regdebtor-close" onClick={onClose} aria-label="Close registration form">
                        <X size={18} strokeWidth={2.2} />
                    </button>
                </header>

                <form className="regdebtor-form" onSubmit={handleSubmit}>
                    <Section title="Account" description="The credit type sets the prefix shown beside the registration number.">
                        <div className="regdebtor-account-row">
                            <Field id="creditType" label="Credit type" i={0}>
                                <div className="regdebtor-select">
                                    <select {...props("creditType")}>
                                        <option value="" disabled>
                                            Select credit type
                                        </option>
                                        {creditTypes.map((type) => (
                                            <option key={type.label} value={type.label}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="regdebtor-select__icon" aria-hidden="true" />
                                </div>
                            </Field>

                            <Field id="creditPrefix" label="Prefix" i={1} required={false}>
                                <output id="creditPrefix" className="regdebtor-prefix" aria-live="polite">
                                    {prefix || "\u2014"}
                                </output>
                            </Field>

                            <Field
                                id="registrationNo"
                                label="Registration no."
                                i={2}
                                className="regdebtor-field--regno"
                                hint={
                                    numberError
                                        ? undefined
                                        : regState === "ready"
                                            ? "Registration number added."
                                            : regState === "missing"
                                                ? "Press + to get the registration number."
                                                : "Choose a credit type first."
                                }
                            >
                                <div className={`regdebtor-regno is-${regState}${numberLoading ? " is-loading" : ""}`}>
                                    {regState === "ready" && (
                                        <span className="regdebtor-regno__badge" aria-hidden="true">
                                            <Check size={14} strokeWidth={3} />
                                        </span>
                                    )}

                                    <input
                                        {...props("registrationNo")}
                                        className="regdebtor-regno__value"
                                        type="text"
                                        autoComplete="off"
                                        readOnly
                                        aria-readonly="true"
                                        placeholder={prefix ? "Add a registration no." : "Select credit type first"}
                                    />

                                    {regState === "missing" && (
                                        <button
                                            type="button"
                                            ref={addBtnRef}
                                            className="regdebtor-regno__add"
                                            onClick={fetchRegistrationNo}
                                            disabled={numberLoading}
                                            aria-label="Add the next registration number"
                                            title="Add the next registration number"
                                        >
                                            {numberLoading ? (
                                                <span className="regdebtor-regno__spinner" aria-hidden="true" />
                                            ) : (
                                                <Plus size={18} strokeWidth={3} />
                                            )}
                                        </button>
                                    )}
                                </div>

                                {numberError && (
                                    <small className="regdebtor-field__error" role="alert">
                                        {numberError}
                                    </small>
                                )}
                            </Field>
                        </div>
                    </Section>

                    <Section title="Personal details" description="Who the customer is and where to reach them.">
                        <Field id="fullName" label="Full name" i={0} wide>
                            <input {...props("fullName")} type="text" placeholder="Enter full name" />
                        </Field>
                        <Field id="nic" label="NIC" i={1}>
                            <input {...props("nic")} type="text" autoComplete="off" placeholder="Enter NIC number" />
                        </Field>
                        <Field id="tele" label="Telephone" i={2}>
                            <input {...props("tele")} type="tel" inputMode="tel" placeholder="Enter telephone number" />
                        </Field>
                        <Field id="permanentAddress" label="Permanent address" i={3} wide>
                            <textarea {...props("permanentAddress")} placeholder="Enter permanent address" />
                        </Field>
                    </Section>

                    <Section title="Business" description="What the customesr does for a living and where.">
                        <Field id="businessType" label="Business type" i={0}>
                            <input {...props("businessType")} type="text" placeholder="Enter business type" />
                        </Field>
                        <Field id="businessRegistrationNo" label="Business registration no." i={1}>
                            <input
                                {...props("businessRegistrationNo")}
                                type="text"
                                autoComplete="off"
                                placeholder="Enter business registration no."
                            />
                        </Field>
                        <Field id="businessAddress" label="Business address" i={2} wide>
                            <textarea {...props("businessAddress")} placeholder="Enter business address" />
                        </Field>
                    </Section>

                    <Section title="Loan" description="Why the loan is needed and how collectors find the house.">
                        <Field id="loanPurpose" label="Purpose of loan" i={0} wide>
                            <input {...props("loanPurpose")} type="text" placeholder="Enter purpose of loan" />
                        </Field>
                        <Field id="routeToHouse" label="Route to house" i={1} wide>
                            <textarea {...props("routeToHouse")} placeholder="Describe the route to the customer's house" />
                        </Field>
                    </Section>

                    <footer className="regdebtor-footer" data-rd-reveal>
                        <div className="regdebtor-progress">
                            <span className="regdebtor-progress__text" aria-live="polite">
                                {done} of {total} fields complete
                            </span>
                            <div
                                className="regdebtor-progress__bar"
                                role="progressbar"
                                aria-label="Form completion"
                                aria-valuemin={0}
                                aria-valuemax={total}
                                aria-valuenow={done}
                            >
                                <span className="regdebtor-progress__fill" style={{ width: `${(done / total) * 100}%` }} />
                            </div>
                        </div>

                        <div className="regdebtor-actions">
                            <button type="button" className="regdebtor-btn regdebtor-btn--ghost" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="regdebtor-btn regdebtor-btn--primary">
                                Register customer
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    );
}