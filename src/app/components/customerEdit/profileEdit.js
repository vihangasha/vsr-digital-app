
"use client";

import { useEffect, useState } from "react";
import {
    X,
    Save,
    UserRound,
    Briefcase,
    FileText,
    Phone,
    LoaderCircle,
} from "lucide-react";

import "../../styles/customerRegistration/registration.css";
import "../../styles/customerEdit/profileEdit.css";

const EDITABLE_FIELDS = [
    {
        section: "Personal details",
        icon: UserRound,
        fields: [
            { name: "fullName", label: "Full name", type: "text", required: true },
            { name: "nic", label: "NIC", type: "text", readOnly: true },
            { name: "contact", label: "Telephone", type: "tel" },
            { name: "permanentAddress", label: "Permanent address", type: "textarea", wide: true },
        ],
    },
    {
        section: "Business details",
        icon: Briefcase,
        fields: [
            { name: "businessType", label: "Business type", type: "text" },
            { name: "businessRegNo", label: "Business registration no.", type: "text" },
            { name: "businessAddress", label: "Business address", type: "textarea", wide: true },
        ],
    },
    {
        section: "Loan details",
        icon: FileText,
        fields: [
            { name: "loanPurpose", label: "Purpose of loan", type: "textarea", wide: true },
            { name: "routeToHouse", label: "Route to house", type: "textarea", wide: true },
        ],
    },
    {
        section: "Additional details",
        icon: Phone,
        fields: [
            { name: "status", label: "Status", type: "text" },
            { name: "loyalty", label: "Loyalty tier", type: "text" },
        ],
    },
];

export default function ProfileEdit({ customer, onClose, onSave }) {
    const [formData, setFormData] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!customer) return;

        const initialData = {};

        EDITABLE_FIELDS.forEach((section) => {
            section.fields.forEach((field) => {
                initialData[field.name] = customer[field.name] ?? "";
            });
        });

        setFormData(initialData);
        setError("");
    }, [customer]);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape" && !saving) {
                onClose?.();
            }
        };

        window.addEventListener("keydown", handleEscape);

        return () => window.removeEventListener("keydown", handleEscape);
    }, [onClose, saving]);

    if (!customer) return null;

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));

        setError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (saving) return;

        if (!formData.fullName?.trim()) {
            setError("Customer name is required.");
            return;
        }

        if (!onSave) {
            setError("Save handler is not connected.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            await onSave({
                ...formData,
                fullName: formData.fullName.trim(),
                nic: customer.nic || customer.id,
            });
        } catch (err) {
            setError(err.message || "Unable to update customer details.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="profile-edit-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !saving) {
                    onClose?.();
                }
            }}
        >
            <div
                className="regdebtor-panel profile-edit"
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-edit-title"
            >
                <article className="regdebtor-card profile-edit__card">

                    {/* Registration form's decorative background */}
                    <div className="regdebtor-bg" aria-hidden="true">
                        <div className="regdebtor-bg__glow" />
                        <span className="regdebtor-stripe regdebtor-stripe--1" />
                        <span className="regdebtor-stripe regdebtor-stripe--2" />
                        <span className="regdebtor-stripe regdebtor-stripe--3" />
                        <span className="regdebtor-stripe regdebtor-stripe--4" />
                        <span className="regdebtor-stripe regdebtor-stripe--5" />
                        <span className="regdebtor-stripe regdebtor-stripe--6" />
                    </div>

                    <div className="profile-edit__content">

                        {/* Header */}
                        <header className="profile-edit__header">
                            <div>
                                <span className="profile-edit__eyebrow">
                                    CUSTOMER MANAGEMENT
                                </span>

                                <h2 id="profile-edit-title">
                                    Edit customer
                                </h2>

                                <p>
                                    Update the customer's information below.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="profile-edit__close"
                                onClick={onClose}
                                disabled={saving}
                                aria-label="Close edit window"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        {/* Form */}
                        <form onSubmit={handleSubmit}>

                            {EDITABLE_FIELDS.map((section) => {
                                const Icon = section.icon;

                                return (
                                    <section
                                        className="profile-edit__section"
                                        key={section.section}
                                    >
                                        <h3>
                                            <span className="profile-edit__section-icon">
                                                <Icon size={16} />
                                            </span>
                                            {section.section}
                                        </h3>

                                        <div className="profile-edit__grid">
                                            {section.fields.map((field) => (
                                                <div
                                                    key={field.name}
                                                    className={`profile-edit__field ${field.wide
                                                            ? "profile-edit__field--wide"
                                                            : ""
                                                        }`}
                                                >
                                                    <label htmlFor={`edit-${field.name}`}>
                                                        {field.label}
                                                        {field.required && (
                                                            <span className="profile-edit__required">
                                                                *
                                                            </span>
                                                        )}
                                                    </label>

                                                    {field.type === "textarea" ? (
                                                        <textarea
                                                            id={`edit-${field.name}`}
                                                            name={field.name}
                                                            value={formData[field.name] ?? ""}
                                                            onChange={handleChange}
                                                            rows={3}
                                                            disabled={saving}
                                                        />
                                                    ) : (
                                                        <input
                                                            id={`edit-${field.name}`}
                                                            name={field.name}
                                                            type={field.type}
                                                            value={formData[field.name] ?? ""}
                                                            onChange={handleChange}
                                                            readOnly={field.readOnly}
                                                            required={field.required}
                                                            disabled={saving}
                                                            className={
                                                                field.readOnly
                                                                    ? "profile-edit__readonly"
                                                                    : ""
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                );
                            })}

                            {error && (
                                <div
                                    className="profile-edit__error"
                                    role="alert"
                                >
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <footer className="profile-edit__actions">
                                <button
                                    type="button"
                                    className="profile-edit__cancel"
                                    onClick={onClose}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="profile-edit__save"
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <>
                                            <LoaderCircle
                                                size={16}
                                                className="profile-edit__spinner"
                                            />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </footer>
                        </form>
                    </div>
                </article>
            </div>
        </div>
    );
}
