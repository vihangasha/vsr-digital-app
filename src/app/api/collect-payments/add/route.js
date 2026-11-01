
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayColombo() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        return null;
    }

    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));

    if (
        date.getUTCFullYear() !== y ||
        date.getUTCMonth() !== m - 1 ||
        date.getUTCDate() !== d
    ) {
        return null;
    }

    return date;
}

/*
 * Company collection holidays.
 *
 * Maintain this list using the official Sri Lankan Poya calendar.
 * The dates for 2028 are provisional and require verification.
 */
const POYA_DATES = new Set([
    // 2026
    "2026-01-03",
    "2026-02-01",
    "2026-03-02",
    "2026-04-01",
    "2026-05-01",
    "2026-05-02",
    "2026-05-30",
    "2026-06-29",
    "2026-07-29",
    "2026-08-27",
    "2026-09-26",
    "2026-10-25",
    "2026-11-24",
    "2026-12-23",

    // 2027
    "2027-01-22",
    "2027-02-20",
    "2027-03-22",
    "2027-04-20",
    "2027-05-19",
    "2027-05-20",
    "2027-06-18",
    "2027-07-18",
    "2027-08-16",
    "2027-09-15",
    "2027-10-15",
    "2027-11-13",
    "2027-12-13",

    // 2028 - provisional; verify against the official calendar
    "2028-01-12",
    "2028-02-25",
    "2028-03-25",
    "2028-04-24",
    "2028-05-23",
    "2028-05-24",
    "2028-06-22",
    "2028-07-21",
    "2028-08-20",
    "2028-09-18",
    "2028-10-18",
    "2028-11-16",
    "2028-12-15",
]);

function isCompanyHoliday(date) {
    const dateString = date.toISOString().slice(0, 10);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    if (month === 1 && day === 1) {
        return true;
    }

    // Company closes April 14 through April 20.
    if (month === 4 && day >= 14 && day <= 20) {
        return true;
    }

    return POYA_DATES.has(dateString);
}

function nextDate(regNo, currentDate) {
    const prefix = regNo.split("-")[0];

    const daysToAdd = {
        D: 1,
        W: 7,
        M: 30,
        MINT: 30,
    }[prefix];

    // Cheque accounts do not use a scheduled collection date.
    if (daysToAdd === undefined) {
        return "";
    }

    const date = parseDate(currentDate);

    if (!date) {
        throw new Error(
            `Invalid nextPayDate for ${regNo}: expected YYYY-MM-DD.`
        );
    }

    date.setUTCDate(date.getUTCDate() + daysToAdd);

    while (isCompanyHoliday(date)) {
        date.setUTCDate(date.getUTCDate() + 1);
    }

    return date.toISOString().slice(0, 10);
}

export async function POST(request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized." },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => null);

        const regNo = String(body?.regNo ?? "")
            .trim()
            .toUpperCase();

        const paymentType = String(
            body?.paymentType ?? "installment"
        )
            .trim()
            .toLowerCase();

        if (!/^(MINT|D|W|M|C)-\d+$/.test(regNo)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Valid registration number required.",
                },
                { status: 400 }
            );
        }

        if (!["installment", "settlement"].includes(paymentType)) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Payment type must be installment or settlement.",
                },
                { status: 400 }
            );
        }

        if (
            regNo.startsWith("C-") &&
            paymentType === "installment"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Scheduled collection for cheque-cashing accounts is not configured.",
                },
                { status: 400 }
            );
        }

        const affairRef = adminDb
            .collection("activeAffairs")
            .doc(regNo);

        const loanQuery = adminDb
            .collection("installments")
            .where("registrationNo", "==", regNo)
            .limit(3);

        const payment = await adminDb.runTransaction(async (tx) => {
            // Read all required documents before writing.
            const affairSnap = await tx.get(affairRef);

            if (!affairSnap.exists) {
                throw new Error(
                    "This account is not active or has already been settled."
                );
            }

            const affair = affairSnap.data();
            const loansSnap = await tx.get(loanQuery);

            if (loansSnap.size !== 1) {
                throw new Error(
                    loansSnap.empty
                        ? "No installment record found for this registration number."
                        : "Multiple installment records found. Collection stopped for safety."
                );
            }

            const loanDoc = loansSnap.docs[0];
            const loanRef = loanDoc.ref;
            const loan = loanDoc.data();

            const affairRegNo = String(
                affair.regNo || affairSnap.id
            ).trim().toUpperCase();

            const loanRegNo = String(
                loan.registrationNo || ""
            ).trim().toUpperCase();

            if (
                affairRegNo !== regNo ||
                loanRegNo !== regNo ||
                (
                    affair.nic &&
                    loan.nic &&
                    String(affair.nic).trim() !==
                    String(loan.nic).trim()
                )
            ) {
                throw new Error(
                    "The active-affair and installment records do not match."
                );
            }

            if (
                loan.status &&
                String(loan.status).toLowerCase() !== "active"
            ) {
                throw new Error("This loan is not active.");
            }

            const outstanding = Number(loan.outstanding);
            const installment = Number(loan.installment);

            if (
                !Number.isFinite(outstanding) ||
                outstanding < 0
            ) {
                throw new Error(
                    "Invalid outstanding balance on the loan record."
                );
            }

            const amount =
                paymentType === "settlement"
                    ? outstanding
                    : installment;

            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error(
                    "The amount to collect must be greater than zero."
                );
            }

            if (
                paymentType === "installment" &&
                amount > outstanding
            ) {
                throw new Error(
                    "Installment exceeds the outstanding balance."
                );
            }

            const newOutstanding = Math.max(
                0,
                outstanding - amount
            );

            const settled =
                paymentType === "settlement" ||
                newOutstanding === 0;

            const collector =
                user.name || user.email || user.uid;

            const paymentRef = adminDb
                .collection("payments")
                .doc();

            const paymentID = paymentRef.id;
            const paymentDate = todayColombo();

            const oldLoanPaid = Number(loan.paidAmount);
            const oldAffairPaid = Number(affair.paidAmount);

            /*
             * Calculate cumulative interestPaid.
             *
             * Installment plans:
             * Allocate equal interest portions based on the
             * contracted interest and the expected installment count.
             *
             * MINT:
             * Regular payments are interest-only.
             * Settlement adds only the remaining contracted interest.
             */
            const oldInterestPaidRaw = Number(
                loan.interestPaid
            );

            const oldInterestPaid =
                Number.isFinite(oldInterestPaidRaw) &&
                    oldInterestPaidRaw >= 0
                    ? oldInterestPaidRaw
                    : 0;

            const issuedAmount = Number(loan.issuedAmount);
            const totalPayable = Number(loan.totalPayable);

            if (
                !Number.isFinite(issuedAmount) ||
                issuedAmount < 0 ||
                !Number.isFinite(totalPayable) ||
                totalPayable < issuedAmount
            ) {
                throw new Error(
                    "Invalid issuedAmount or totalPayable on the loan record."
                );
            }

            const totalContractedInterest = Math.max(
                0,
                totalPayable - issuedAmount
            );

            const remainingContractedInterest = Math.max(
                0,
                totalContractedInterest - oldInterestPaid
            );

            let interestIncrement = 0;

            if (regNo.startsWith("MINT-")) {
                // Monthly-interest regular collections are interest-only.
                interestIncrement =
                    paymentType === "settlement"
                        ? remainingContractedInterest
                        : Math.min(
                            amount,
                            remainingContractedInterest
                        );
            } else if (paymentType === "settlement") {
                // Add any contracted interest not yet recorded as paid.
                interestIncrement =
                    remainingContractedInterest;
            } else {
                const installmentCount =
                    installment > 0
                        ? Math.max(
                            1,
                            Math.round(
                                totalPayable / installment
                            )
                        )
                        : 0;

                if (installmentCount === 0) {
                    throw new Error(
                        "Cannot calculate interest without a valid installment amount."
                    );
                }

                const interestPerInstallment =
                    totalContractedInterest / installmentCount;

                interestIncrement = Math.min(
                    interestPerInstallment,
                    remainingContractedInterest
                );
            }

            const newInterestPaid = Math.min(
                totalContractedInterest,
                Math.round(
                    (oldInterestPaid + interestIncrement + Number.EPSILON) * 100
                ) / 100
            );

            /*
             * Calculate the post-collection state.
             */
            const currentPaidCount = Math.max(
                0,
                Number(affair.paidCount) || 0
            );

            const currentDueCount = Math.max(
                0,
                Number(affair.dueCount) || 0
            );

            const totalPaid =
                (Number.isFinite(oldAffairPaid)
                    ? oldAffairPaid
                    : 0) + amount;

            const paymentCount = currentPaidCount + 1;

            const dueCount = settled
                ? 0
                : Math.max(0, currentDueCount - 1);

            const receiptData = {
                paymentID,
                insID: loan.insID || loanDoc.id,
                regNo,
                nic: String(loan.nic || affair.nic || ""),
                name: String(loan.name || ""),
                amount,
                paymentType,
                paymentDate,
                collectedBy: collector,
            };

            // Save the immutable payment-history record.
            tx.create(paymentRef, {
                ...receiptData,
                createdAt: FieldValue.serverTimestamp(),
            });

            // Update installment balance and cumulative payment totals.
            tx.update(loanRef, {
                outstanding: newOutstanding,
                paidAmount:
                    (Number.isFinite(oldLoanPaid)
                        ? oldLoanPaid
                        : 0) + amount,
                interestPaid: newInterestPaid,
                status: settled
                    ? "completed"
                    : loan.status || "active",
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: collector,
            });

            if (settled) {
                // Remove the account from active affairs after settlement.
                tx.delete(affairRef);
            } else {
                const scheduledDate = nextDate(
                    regNo,
                    String(affair.nextPayDate || "")
                );

                tx.update(affairRef, {
                    paidCount: paymentCount,
                    paidAmount: totalPaid,
                    dueAmount: newOutstanding,
                    dueCount,

                    ...(scheduledDate
                        ? { nextPayDate: scheduledDate }
                        : {}),
                });

                // Keep installments.nextPayDate synchronized.
                if (scheduledDate) {
                    tx.update(loanRef, {
                        nextPayDate: scheduledDate,
                    });
                }
            }

            // Return the values after collection for the receipt.
            return {
                ...receiptData,
                paymentCount,
                totalPaid,
                dueCount,
                dueAmount: newOutstanding,
                outstanding: newOutstanding,
                settled,
            };
        });

        return NextResponse.json(
            { success: true, payment },
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "POST /api/collect-payments/add:",
            error
        );

        const message =
            error instanceof Error
                ? error.message
                : "Payment collection failed.";

        const status =
            message === "Unauthorized."
                ? 401
                : /required|valid registration|must be/i.test(
                    message
                )
                    ? 400
                    : 409;

        return NextResponse.json(
            { success: false, error: message },
            { status }
        );
    }
}
