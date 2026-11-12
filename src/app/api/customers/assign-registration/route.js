
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const REGISTRATION_CONFIG = {
    D: {
        helperField: "daily",
        customerField: "dailyRegNo",
    },
    W: {
        helperField: "weekly",
        customerField: "weeklyRegNo",
    },
    M: {
        helperField: "monthly",
        customerField: "monthlyRegNo",
    },
    MINT: {
        helperField: "monthly-int",
        customerField: "MintRegNo",
    },
    CH: {
        helperField: "chqRegNo",
        customerField: "chqRegNo",
    },
};

function getNextNumber(currentNumber, prefix) {
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escapedPrefix}-(\\d{4,})$`);
    const match = currentNumber.match(pattern);

    if (!match) {
        throw new Error("INVALID_HELPER_NUMBER");
    }

    const currentValue = Number(match[1]);

    if (!Number.isSafeInteger(currentValue)) {
        throw new Error("INVALID_HELPER_NUMBER");
    }

    return `${prefix}-${String(currentValue + 1).padStart(match[1].length, "0")}`;
}

export async function POST(request) {
    try {
        // -----------------------------------------------
        // Authentication
        // -----------------------------------------------

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

        // -----------------------------------------------
        // Request validation
        // -----------------------------------------------

        const body = await request.json();

        const nic = String(body.nic || "").trim();
        const prefix = String(body.prefix || "").trim().toUpperCase();
        const registrationNo = String(body.registrationNo || "")
            .trim()
            .toUpperCase();

        if (!nic || !prefix || !registrationNo) {
            return NextResponse.json(
                {
                    success: false,
                    error: "NIC, prefix and registration number are required.",
                },
                { status: 400 }
            );
        }

        const config = REGISTRATION_CONFIG[prefix];

        if (!config) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid registration prefix.",
                },
                { status: 400 }
            );
        }

        const expectedPattern = new RegExp(
            `^${prefix}-(\\d{4,})$`
        );

        if (!expectedPattern.test(registrationNo)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Registration number format is invalid.",
                },
                { status: 400 }
            );
        }

        // -----------------------------------------------
        // Firestore references
        // -----------------------------------------------

        const customerRef = adminDb
            .collection("customers")
            .doc(nic);

        const helperRef = adminDb
            .collection("autonum-helper")
            .doc("helperID");

        const duplicateQuery = adminDb
            .collection("customers")
            .where(config.customerField, "==", registrationNo)
            .limit(2);

        // -----------------------------------------------
        // Atomic assignment + helper increment
        // -----------------------------------------------

        const result = await adminDb.runTransaction(async (transaction) => {
            // All reads happen before writes.
            const customerSnapshot = await transaction.get(customerRef);
            const helperSnapshot = await transaction.get(helperRef);
            const duplicateSnapshot = await transaction.get(duplicateQuery);

            if (!customerSnapshot.exists) {
                throw new Error("CUSTOMER_NOT_FOUND");
            }

            if (!helperSnapshot.exists) {
                throw new Error("HELPER_NOT_FOUND");
            }

            const customerData = customerSnapshot.data();

            // The selected registration field must still be empty.
            const existingValue = String(
                customerData[config.customerField] || ""
            ).trim();

            if (existingValue && existingValue !== "N/A") {
                throw new Error("REGISTRATION_ALREADY_EXISTS");
            }

            // The submitted number must still be the current helper value.
            const helperData = helperSnapshot.data();

            const currentNumber = String(
                helperData[config.helperField] || ""
            ).trim().toUpperCase();

            if (currentNumber !== registrationNo) {
                throw new Error("NUMBER_NO_LONGER_AVAILABLE");
            }

            // Check for duplicate registration numbers.
            const duplicateDoc = duplicateSnapshot.docs.find(
                (doc) => doc.id !== nic
            );

            if (duplicateDoc) {
                throw new Error("DUPLICATE_REGISTRATION");
            }

            // Calculate the next number.
            const nextNumber = getNextNumber(
                currentNumber,
                prefix
            );

            // Update the existing customer.
            transaction.update(customerRef, {
                [config.customerField]: registrationNo,
            });

            // Increment only the matching helper field.
            transaction.update(helperRef, {
                [config.helperField]: nextNumber,
            });

            return {
                registrationNo,
                nextNumber,
                customerField: config.customerField,
                helperField: config.helperField,
            };
        });

        return NextResponse.json(
            {
                success: true,
                message: "Registration number assigned successfully.",
                ...result,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("Customer registration assignment error:", error);

        const errors = {
            CUSTOMER_NOT_FOUND: {
                status: 404,
                message: "Customer not found.",
            },
            HELPER_NOT_FOUND: {
                status: 500,
                message: "Auto-number helper document not found.",
            },
            REGISTRATION_ALREADY_EXISTS: {
                status: 409,
                message: "This customer already has a registration number for this type.",
            },
            NUMBER_NO_LONGER_AVAILABLE: {
                status: 409,
                message: "This number is no longer available. Please fetch the latest number.",
            },
            DUPLICATE_REGISTRATION: {
                status: 409,
                message: "This registration number is already assigned to another customer.",
            },
            INVALID_HELPER_NUMBER: {
                status: 500,
                message: "The stored auto-number value is invalid.",
            },
        };

        const knownError = errors[error.message];

        if (knownError) {
            return NextResponse.json(
                {
                    success: false,
                    error: knownError.message,
                },
                { status: knownError.status }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: "Unable to assign registration number.",
            },
            { status: 500 }
        );
    }
}
