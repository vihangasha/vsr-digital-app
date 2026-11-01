
"use client";

import { useEffect } from "react";
import "../../styles/thermalBill/thermalBill.css";

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Colombo",
    });
}

function formatTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleTimeString("en-LK", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Colombo",
    });
}

function formatMoney(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) return "Rs. 0.00";

    return `Rs. ${amount.toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export default function ThermalBill({
    receipt = null,
    logoSrc = "/logo/logo-invrt.png",
    autoPrint = false,
    onClose,
}) {
    useEffect(() => {
        if (!autoPrint || !receipt) return;

        const timer = setTimeout(() => {
            window.print();
        }, 500);

        return () => clearTimeout(timer);
    }, [autoPrint, receipt]);

    if (!receipt) return null;

    const paymentDate =
        receipt.paymentDate ||
        (receipt.collectedAt
            ? receipt.collectedAt.slice(0, 10)
            : "");

    const paymentType =
        receipt.paymentType === "settlement"
            ? "Full settlement"
            : "Installment";

    return (
        <>
            <div className="thermal-bill">
                <header className="thermal-bill__brand">
                    <img
                        className="thermal-bill__logo-image"
                        src={logoSrc}
                        alt="VSR"
                    />

                    <div className="thermal-bill__title">
                        PAYMENT RECEIPT
                    </div>

                    <div className="thermal-bill__date">
                        {formatDate(paymentDate)}{" "}
                        {" · "}{" "}
                        {formatTime(receipt.collectedAt)}
                    </div>
                </header>

                <div className="thermal-bill__ref">
                    <span className="thermal-bill__ref-label">
                        Reference
                    </span>

                    {receipt.paymentID || "—"}
                </div>

                <section className="thermal-bill__section">
                    <ReceiptRow
                        label="Registration No."
                        value={receipt.regNo}
                    />

                    <ReceiptRow
                        label="Customer NIC No."
                        value={receipt.nic}
                    />
                </section>

                <section className="thermal-bill__section">
                    <ReceiptRow
                        label="Customer Name"
                        value={receipt.name}
                    />

                    <ReceiptRow
                        label="Collected By"
                        value={receipt.collectedBy}
                    />

                    <ReceiptRow
                        label="Payment Type"
                        value={paymentType}
                    />

                    <ReceiptRow
                        label="Payment Count"
                        value={receipt.paymentCount}
                    />
                </section>

                <section className="thermal-bill__section">
                    <ReceiptRow
                        label="Total Paid"
                        value={formatMoney(receipt.totalPaid)}
                    />

                    <ReceiptRow
                        label="Due Count"
                        value={receipt.dueCount}
                    />

                    <ReceiptRow
                        label="Balance Due"
                        value={formatMoney(receipt.outstanding)}
                    />
                </section>

                <section className="thermal-bill__amount">
                    <div className="thermal-bill__amount-label">
                        AMOUNT COLLECTED
                    </div>

                    <div className="thermal-bill__amount-value">
                        {formatMoney(receipt.amount)}
                    </div>
                </section>

                <footer className="thermal-bill__footer">
                    <div className="thermal-bill__footer-logo">
                        VSRD
                    </div>

                    <div className="thermal-bill__footer-brand">
                        VSR DIGITAL
                    </div>
                </footer>
            </div>

            <div className="thermal-bill__screen-controls">
                <button
                    type="button"
                    onClick={() => window.print()}
                >
                    Print receipt
                </button>

                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                    >
                        Close
                    </button>
                )}
            </div>
        </>
    );
}

function ReceiptRow({ label, value }) {
    return (
        <div className="thermal-bill__row">
            <span className="thermal-bill__label">
                {label}
            </span>

            <span className="thermal-bill__value">
                {value === null ||
                    value === undefined ||
                    value === ""
                    ? "—"
                    : String(value)}
            </span>
        </div>
    );
}
