
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

function getBehavior(daysPassed) {
    if (daysPassed <= 3) return "on time";
    if (daysPassed <= 7) return "neutral";
    if (daysPassed <= 20) return "flagged";
    return "deserter";
}

function addOneDay(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new Error("Invalid nextPayDate format.");
    }

    const date = new Date(`${dateString}T00:00:00.000Z`);

    if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dateString
    ) {
        throw new Error("Invalid nextPayDate value.");
    }

    date.setUTCDate(date.getUTCDate() + 1);

    return date.toISOString().slice(0, 10);
}

export async function POST(request) {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Unauthorized. Please log in.",
                },
                { status: 401 }
            );
        }

        const body = await request.json();

        const regNo = String(body.regNo ?? "")
            .trim()
            .toUpperCase();

        if (!/^(MINT|D|W|M|C)-\d+$/.test(regNo)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "A valid registration number is required.",
                },
                { status: 400 }
            );
        }

        const affairRef = adminDb
            .collection("activeAffairs")
            .doc(regNo);

        const installmentsQuery = adminDb
            .collection("installments")
            .where("registrationNo", "==", regNo)
            .limit(2);

        const result = await adminDb.runTransaction(
            async (transaction) => {
                // Read the active affair.
                const affairSnapshot =
                    await transaction.get(affairRef);

                if (!affairSnapshot.exists) {
                    const error = new Error(
                        "No active affair found for this registration number."
                    );
                    error.status = 404;
                    throw error;
                }

                const affair = affairSnapshot.data();

                if (affair.regNo && affair.regNo !== regNo) {
                    const error = new Error(
                        "Registration number does not match the active affair."
                    );
                    error.status = 409;
                    throw error;
                }

                // Find the corresponding installment record.
                const installmentsSnapshot =
                    await transaction.get(installmentsQuery);

                if (installmentsSnapshot.empty) {
                    const error = new Error(
                        "No installment record found for this registration number."
                    );
                    error.status = 404;
                    throw error;
                }

                if (installmentsSnapshot.size > 1) {
                    const error = new Error(
                        "Multiple installment records found for this registration number."
                    );
                    error.status = 409;
                    throw error;
                }

                const installmentDoc = installmentsSnapshot.docs[0];
                const installmentRef = installmentDoc.ref;

                const currentDays = Number(affair.daysPassed ?? 0);

                if (
                    !Number.isInteger(currentDays) ||
                    currentDays < 0
                ) {
                    const error = new Error(
                        "The active affair has an invalid daysPassed value."
                    );
                    error.status = 409;
                    throw error;
                }

                const scheduledDate = String(
                    affair.nextPayDate ?? ""
                );

                if (!scheduledDate) {
                    const error = new Error(
                        "This active affair has no scheduled payment date."
                    );
                    error.status = 409;
                    throw error;
                }

                // Advance the existing scheduled date by one day.
                const nextPayDate = addOneDay(scheduledDate);

                const daysPassed = currentDays + 1;
                const behavior = getBehavior(daysPassed);

                // Update the active affair's Daypass fields.
                transaction.update(affairRef, {
                    nextPayDate,
                    daysPassed,
                    behavior,
                });

                // Keep the installment's date synchronized.
                // No other installment fields are changed.
                transaction.update(installmentRef, {
                    nextPayDate,
                });

                return {
                    regNo,
                    insID: installmentDoc.id,
                    nextPayDate,
                    daysPassed,
                    behavior,
                };
            }
        );

        return NextResponse.json({
            success: true,
            message:
                "Collection passed successfully. Both payment dates have been updated.",
            activeAffair: result,
        });
    } catch (error) {
        console.error("Day pass error:", error);

        const status = error.status || 500;

        return NextResponse.json(
            {
                success: false,
                error:
                    status === 500
                        ? "Failed to pass this collection."
                        : error.message,
            },
            { status }
        );
    }
}
