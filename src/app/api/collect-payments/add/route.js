
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { getNextBusinessPayDateFrom } from "@/lib/businessHolidays";

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

        // Full settlement is restricted to MINT accounts.
        // This validation is enforced by the API, not just the UI.
        if (
            paymentType === "settlement" &&
            !regNo.startsWith("MINT-")
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Full settlement is currently available only for Monthly Interest (MINT) accounts.",
                },
                { status: 403 }
            );
        }

        if (!["installment", "settlement"].includes(paymentType)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Payment type must be installment or settlement.",
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
                    error: "Scheduled collection for cheque-cashing accounts is not configured.",
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
            // -----------------------------------------
            // 1. FETCH ACTIVE AFFAIR
            // -----------------------------------------

            const affairSnap = await tx.get(affairRef);

            if (!affairSnap.exists) {
                throw new Error(
                    "This account is not active or has already been settled."
                );
            }

            const affair = affairSnap.data();

            const isMint = regNo.startsWith("MINT-");

            // Prevent additional regular installments after
            // the scheduled affair has reached pending status.
            if (
                String(affair.status || "")
                    .trim()
                    .toLowerCase() === "pending" &&
                paymentType !== "settlement"
            ) {
                throw new Error(
                    "This affair has completed its scheduled installments. Only MINT full settlement may be processed."
                );
            }

            // -----------------------------------------
            // 2. FETCH INSTALLMENT RECORD
            // -----------------------------------------

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
            )
                .trim()
                .toUpperCase();

            const loanRegNo = String(
                loan.registrationNo || ""
            )
                .trim()
                .toUpperCase();

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

            // -----------------------------------------
            // 3. VALIDATE BALANCES
            // -----------------------------------------

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

            const activeAffairDue = Number(affair.dueAmount);

            if (
                isMint &&
                (
                    !Number.isFinite(activeAffairDue) ||
                    activeAffairDue < 0
                )
            ) {
                throw new Error(
                    "Invalid due amount on the active-affair record."
                );
            }

            if (
                isMint &&
                Math.abs(activeAffairDue - outstanding) > 0.01
            ) {
                throw new Error(
                    "The MINT principal balance does not match between the loan and active-affair records. Collection stopped for safety."
                );
            }

            if (
                !Number.isFinite(installment) ||
                installment <= 0
            ) {
                throw new Error(
                    "Invalid monthly interest amount on the loan record."
                );
            }

            // -----------------------------------------
            // 4. CALCULATE PAYMENT
            // -----------------------------------------

            /*
             * MINT:
             * Normal payment = monthly interest only.
             * Full settlement = outstanding principal + one month's interest.
             *
             * Other accounts:
             * Normal payment = scheduled installment.
             * Settlement = remaining outstanding.
             */

            const amount = isMint
                ? paymentType === "settlement"
                    ? activeAffairDue + installment
                    : installment
                : paymentType === "settlement"
                    ? outstanding
                    : installment;

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                throw new Error(
                    "The amount to collect must be greater than zero."
                );
            }

            if (
                paymentType === "installment" &&
                !isMint &&
                amount > outstanding
            ) {
                throw new Error(
                    "Installment exceeds the outstanding balance."
                );
            }

            const newOutstanding = isMint
                ? paymentType === "settlement"
                    ? 0
                    : outstanding
                : Math.max(0, outstanding - amount);

            const settled =
                paymentType === "settlement" ||
                (!isMint && newOutstanding === 0);

            // -----------------------------------------
            // 5. COLLECTOR AND PAYMENT INFORMATION
            // -----------------------------------------

            const collector =
                user.name || user.email || user.uid;

            const paymentRef = adminDb
                .collection("payments")
                .doc();

            const paymentID = paymentRef.id;
            const paymentDate = todayColombo();

            const oldLoanPaid = Number(loan.paidAmount);
            const oldAffairPaid = Number(affair.paidAmount);

            const oldInterestPaidRaw = Number(loan.interestPaid);

            const oldInterestPaid =
                Number.isFinite(oldInterestPaidRaw) &&
                    oldInterestPaidRaw >= 0
                    ? oldInterestPaidRaw
                    : 0;

            const issuedAmount = Number(loan.issuedAmount);

            const totalPayable =
                loan.totalPayable == null
                    ? null
                    : Number(loan.totalPayable);

            if (
                !Number.isFinite(issuedAmount) ||
                issuedAmount <= 0 ||
                (
                    !isMint &&
                    (
                        !Number.isFinite(totalPayable) ||
                        totalPayable < issuedAmount
                    )
                )
            ) {
                throw new Error(
                    "Invalid issuedAmount or totalPayable on the loan record."
                );
            }

            // -----------------------------------------
            // 6. INTEREST ACCOUNTING
            // -----------------------------------------

            const totalContractedInterest = isMint
                ? 0
                : Math.max(0, totalPayable - issuedAmount);

            const remainingContractedInterest = Math.max(
                0,
                totalContractedInterest - oldInterestPaid
            );

            let interestIncrement = 0;

            if (isMint) {
                // MINT settlement includes one month's interest.
                interestIncrement = installment;
            } else if (paymentType === "settlement") {
                interestIncrement = remainingContractedInterest;
            } else {
                const installmentCount = Math.max(
                    1,
                    Math.round(totalPayable / installment)
                );

                const interestPerInstallment =
                    totalContractedInterest / installmentCount;

                interestIncrement = Math.min(
                    interestPerInstallment,
                    remainingContractedInterest
                );
            }

            const newInterestPaid = isMint
                ? Math.round(
                    (
                        oldInterestPaid +
                        interestIncrement +
                        Number.EPSILON
                    ) * 100
                ) / 100
                : Math.min(
                    totalContractedInterest,
                    Math.round(
                        (
                            oldInterestPaid +
                            interestIncrement +
                            Number.EPSILON
                        ) * 100
                    ) / 100
                );

            // -----------------------------------------
            // 7. UPDATE INSTALLMENT COUNTS
            // -----------------------------------------

            const currentPaidCount = Math.max(
                0,
                Number(affair.paidCount) || 0
            );

            const currentDueCount = Math.max(
                0,
                Number(affair.dueCount) || 0
            );

            const totalPaid =
                (
                    Number.isFinite(oldAffairPaid)
                        ? oldAffairPaid
                        : 0
                ) + amount;

            const paymentCount = currentPaidCount + 1;

            const dueCount = settled
                ? 0
                : Math.max(0, currentDueCount - 1);

            // -----------------------------------------
            // 8. CREATE PAYMENT HISTORY
            // -----------------------------------------

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

                ...(isMint
                    ? {
                        principalAmount:
                            paymentType === "settlement"
                                ? activeAffairDue
                                : 0,

                        interestAmount: installment,
                    }
                    : {}),
            };

            tx.create(paymentRef, {
                ...receiptData,
                createdAt: FieldValue.serverTimestamp(),
            });

            // -----------------------------------------
            // 9. UPDATE INSTALLMENT DOCUMENT
            // -----------------------------------------

            tx.update(loanRef, {
                outstanding: newOutstanding,

                paidAmount:
                    (
                        Number.isFinite(oldLoanPaid)
                            ? oldLoanPaid
                            : 0
                    ) + amount,

                interestPaid: newInterestPaid,

                status: settled
                    ? "completed"
                    : loan.status || "active",

                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: collector,
            });

            // -----------------------------------------
            // 10. UPDATE ACTIVE AFFAIR
            // -----------------------------------------

            /*
             * IMPORTANT:
             * Do not delete the activeAffairs document.
             *
             * When dueCount reaches zero:
             * - status becomes pending
             * - nextPayDate becomes an empty string
             * - dueCount remains zero
             *
             * This applies to completed installment schedules
             * and MINT full settlements.
             */

            if (dueCount === 0) {
                tx.update(affairRef, {
                    paidCount: paymentCount,
                    paidAmount: totalPaid,
                    dueAmount: newOutstanding,
                    dueCount: 0,
                    status: "pending",
                    nextPayDate: "",
                    updatedAt: FieldValue.serverTimestamp(),
                });
            } else {
                // Calculate the next collection date using
                // the centralized business holiday utility.
                const scheduledDate =
                    getNextBusinessPayDateFrom(
                        regNo,
                        String(affair.nextPayDate || "")
                    );

                tx.update(affairRef, {
                    paidCount: paymentCount,
                    paidAmount: totalPaid,
                    dueAmount: newOutstanding,
                    dueCount,
                    status: "active",
                    nextPayDate: scheduledDate,
                    updatedAt: FieldValue.serverTimestamp(),
                });

                if (scheduledDate) {
                    tx.update(loanRef, {
                        nextPayDate: scheduledDate,
                    });
                }
            }

            // -----------------------------------------
            // 11. RETURN PAYMENT RESULT
            // -----------------------------------------

            return {
                ...receiptData,
                paymentCount,
                totalPaid,
                dueCount,
                dueAmount: newOutstanding,
                outstanding: newOutstanding,
                settled,
                affairStatus:
                    dueCount === 0 ? "pending" : "active",
            };
        });

        return NextResponse.json(
            {
                success: true,
                payment,
            },
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
                : /required|valid registration|must be/i.test(message)
                    ? 400
                    : 409;

        return NextResponse.json(
            {
                success: false,
                error: message,
            },
            { status }
        );
    }
}
