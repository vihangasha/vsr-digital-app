
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

const REGISTRATION_CONFIG = {
    D: {
        creditType: "daily",
        helperField: "daily",
        customerField: "dailyRegNo",
    },
    M: {
        creditType: "monthly",
        helperField: "monthly",
        customerField: "monthlyRegNo",
    },
    MINT: {
        creditType: "mint",
        helperField: "monthly-int",
        customerField: "MintRegNo",
    },
    W: {
        creditType: "weekly",
        helperField: "weekly",
        customerField: "weeklyRegNo",
    },
    CH: {
        creditType: "chq",
        helperField: "chqRegNo",
        customerField: "chqRegNo",
    },
};

function normalizeCreditType(value) {
    const type = String(value || "").trim().toLowerCase();

    if (["daily", "daily collect"].includes(type)) return "daily";
    if (["weekly", "weekly installment"].includes(type)) return "weekly";
    if (["monthly", "monthly collect"].includes(type)) return "monthly";
    if (["mint", "monthly interest"].includes(type)) return "mint";
    if (["chq", "cheque", "cheque cashing"].includes(type)) return "chq";

    return null;
}

function getNextRegistrationNumber(currentNumber, prefix) {
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escapedPrefix}-(\\d{4,})$`);
    const match = currentNumber.match(pattern);

    if (!match) {
        throw new Error("Invalid registration number format in auto-number helper.");
    }

    const currentValue = Number(match[1]);

    if (!Number.isSafeInteger(currentValue)) {
        throw new Error("Auto-number counter has reached an invalid value.");
    }

    const nextValue = currentValue + 1;
    return `${prefix}-${String(nextValue).padStart(match[1].length, "0")}`;
}

export async function POST(request) {
    try {
        // --------------------------------------------------
        // Authentication
        // --------------------------------------------------

        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: "Unauthorized. Please log in." },
                { status: 401 }
            );
        }

        // --------------------------------------------------
        // Read and validate request
        // --------------------------------------------------

        const body = await request.json();

        const {
            nic,
            fullName,
            contact,
            permanentAddress,
            businessType,
            businessRegNo,
            businessAddress,
            loanPurpose,
            routeToHouse,
            creditType,
            prefix,
            newRegNo,
            loyalty,
            status,
        } = body;

        const cleanNic = String(nic || "").trim();
        const cleanRegNo = String(newRegNo || "").trim().toUpperCase();
        const cleanPrefix = String(prefix || "").trim().toUpperCase();

        if (!cleanNic) {
            return NextResponse.json(
                { error: "NIC is required." },
                { status: 400 }
            );
        }

        if (!cleanRegNo) {
            return NextResponse.json(
                { error: "Registration number is required." },
                { status: 400 }
            );
        }

        const normalizedCreditType = normalizeCreditType(creditType);

        if (!normalizedCreditType) {
            return NextResponse.json(
                { error: "Invalid credit type." },
                { status: 400 }
            );
        }

        const config = REGISTRATION_CONFIG[cleanPrefix];

        if (!config || config.creditType !== normalizedCreditType) {
            return NextResponse.json(
                { error: "Registration prefix does not match the selected credit type." },
                { status: 400 }
            );
        }

        const registrationField = config.customerField;

        const helperRef = adminDb
            .collection("autonum-helper")
            .doc("helperID");

        const customerRef = adminDb
            .collection("customers")
            .doc(cleanNic);

        const duplicateQuery = adminDb
            .collection("customers")
            .where(registrationField, "==", cleanRegNo)
            .limit(2);

        // --------------------------------------------------
        // Atomic customer registration + counter increment
        // --------------------------------------------------

        const result = await adminDb.runTransaction(async (transaction) => {
            // All reads must happen before writes.
            const helperSnapshot = await transaction.get(helperRef);
            const customerSnapshot = await transaction.get(customerRef);
            const duplicateSnapshot = await transaction.get(duplicateQuery);

            if (!helperSnapshot.exists) {
                throw new Error("AUTO_NUMBER_HELPER_NOT_FOUND");
            }

            const helperData = helperSnapshot.data();
            const currentHelperNumber = String(
                helperData[config.helperField] || ""
            ).trim().toUpperCase();

            // The submitted number must still be the current helper number.
            // This prevents two users from registering with the same number.
            if (currentHelperNumber !== cleanRegNo) {
                throw new Error("REGISTRATION_NUMBER_CHANGED");
            }

            // Check for duplicate registration numbers.
            const duplicateDoc = duplicateSnapshot.docs.find(
                (doc) => doc.id !== cleanNic
            );

            if (duplicateDoc) {
                throw new Error("DUPLICATE_REGISTRATION_NUMBER");
            }

            // --------------------------------------------------
            // Existing customer
            // Only add the missing registration number.
            // --------------------------------------------------

            if (customerSnapshot.exists) {
                const customerData = customerSnapshot.data();

                const existingRegistration = String(
                    customerData[registrationField] || ""
                ).trim();

                if (
                    existingRegistration &&
                    existingRegistration !== "N/A"
                ) {
                    throw new Error("CUSTOMER_REGISTRATION_EXISTS");
                }

                transaction.update(customerRef, {
                    [registrationField]: cleanRegNo,
                });

                const nextNumber = getNextRegistrationNumber(
                    currentHelperNumber,
                    cleanPrefix
                );

                transaction.update(helperRef, {
                    [config.helperField]: nextNumber,
                });

                return {
                    action: "registration-added",
                    registrationNo: cleanRegNo,
                    registrationField,
                    nextNumber,
                };
            }

            // --------------------------------------------------
            // New customer
            // --------------------------------------------------

            const auditValue =
                currentUser.role === "developer"
                    ? "system"
                    : currentUser.role || "system";

            transaction.set(customerRef, {
                nic: cleanNic,

                fullName: String(fullName || "").trim(),
                contact: String(contact || "").trim(),
                permanentAddress: String(permanentAddress || "").trim(),

                businessType: String(businessType || "").trim(),
                businessRegNo: String(businessRegNo || "").trim(),
                businessAddress: String(businessAddress || "").trim(),

                loanPurpose: String(loanPurpose || "").trim(),
                routeToHouse: String(routeToHouse || "").trim(),

                dailyRegNo:
                    normalizedCreditType === "daily" ? cleanRegNo : "",

                weeklyRegNo:
                    normalizedCreditType === "weekly" ? cleanRegNo : "",

                monthlyRegNo:
                    normalizedCreditType === "monthly" ? cleanRegNo : "",

                MintRegNo:
                    normalizedCreditType === "mint" ? cleanRegNo : "",

                chqRegNo:
                    normalizedCreditType === "chq" ? cleanRegNo : "",

                loyalty: String(loyalty || "").trim(),
                status: String(status || "active").trim(),

                createdAt: new Date(),
                createdBy: auditValue,

                updatedAt: "N/A",
                updatedBy: "N/A",
            });

            const nextNumber = getNextRegistrationNumber(
                currentHelperNumber,
                cleanPrefix
            );

            transaction.update(helperRef, {
                [config.helperField]: nextNumber,
            });

            return {
                action: "customer-created",
                registrationNo: cleanRegNo,
                registrationField,
                nextNumber,
            };
        });

        // --------------------------------------------------
        // Success
        // --------------------------------------------------

        return NextResponse.json(
            {
                success: true,
                action: result.action,
                nic: cleanNic,
                registrationNo: result.registrationNo,
                registrationField: result.registrationField,
                nextNumber: result.nextNumber,
                message:
                    result.action === "registration-added"
                        ? "New registration number added successfully."
                        : "Customer registered successfully.",
            },
            {
                status: result.action === "customer-created" ? 201 : 200,
            }
        );
    } catch (error) {
        console.error("Customer creation error:", error);

        if (error.message === "AUTO_NUMBER_HELPER_NOT_FOUND") {
            return NextResponse.json(
                { error: "Auto-number helper document not found." },
                { status: 500 }
            );
        }

        if (error.message === "REGISTRATION_NUMBER_CHANGED") {
            return NextResponse.json(
                {
                    error: "This registration number is no longer available. Please add the latest number and try again.",
                },
                { status: 409 }
            );
        }

        if (error.message === "DUPLICATE_REGISTRATION_NUMBER") {
            return NextResponse.json(
                {
                    error: "This registration number is already assigned to another customer.",
                },
                { status: 409 }
            );
        }

        if (error.message === "CUSTOMER_REGISTRATION_EXISTS") {
            return NextResponse.json(
                {
                    error: "User registration already exists.",
                },
                { status: 409 }
            );
        }

        if (
            error.message?.includes("Invalid registration number format") ||
            error.message?.includes("Auto-number counter")
        ) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Unable to register customer." },
            { status: 500 }
        );
    }
}
