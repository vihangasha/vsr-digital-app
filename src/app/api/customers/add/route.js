import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

const REGISTRATION_FIELDS = {
    daily: "dailyRegNo",
    weekly: "weeklyRegNo",
    monthly: "monthlyRegNo",
    mint: "MintRegNo",
    chq: "chqRegNo",
};

function normalizeCreditType(value) {
    const type = String(value || "").trim().toLowerCase();

    if (["daily", "daily collect", "d"].includes(type)) {
        return "daily";
    }

    if (["weekly", "weekly installment", "w"].includes(type)) {
        return "weekly";
    }

    if (["monthly", "monthly collect", "m"].includes(type)) {
        return "monthly";
    }

    if (["mint", "monthly interest", "mint interest"].includes(type)) {
        return "mint";
    }

    if (["chq", "cheque", "cheque cashing", "c"].includes(type)) {
        return "chq";
    }

    return null;
}

export async function POST(request) {
    try {
        // --------------------------------------------------
        // Check signed-in user
        // --------------------------------------------------

        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: "Unauthorized. Please log in." },
                { status: 401 }
            );
        }

        // --------------------------------------------------
        // Read request
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
            newRegNo,
            loyalty,
            status,
        } = body;

        const cleanNic = String(nic || "").trim();
        const cleanRegNo = String(newRegNo || "").trim().toUpperCase();

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

        const registrationField =
            REGISTRATION_FIELDS[normalizedCreditType];

        // --------------------------------------------------
        // Customer document is identified by NIC
        // --------------------------------------------------

        const customerRef = adminDb
            .collection("customers")
            .doc(cleanNic);

        const customerSnapshot = await customerRef.get();

        // --------------------------------------------------
        // Check whether this registration number is already
        // assigned to another customer.
        // --------------------------------------------------

        const duplicateSnapshot = await adminDb
            .collection("customers")
            .where(registrationField, "==", cleanRegNo)
            .limit(1)
            .get();

        if (!duplicateSnapshot.empty) {
            const duplicateDoc = duplicateSnapshot.docs[0];

            if (duplicateDoc.id !== cleanNic) {
                return NextResponse.json(
                    {
                        error: "This registration number is already assigned to another customer.",
                    },
                    { status: 409 }
                );
            }
        }

        // --------------------------------------------------
        // CUSTOMER ALREADY EXISTS
        // --------------------------------------------------

        if (customerSnapshot.exists) {
            const customerData = customerSnapshot.data();

            const existingRegistration =
                String(customerData[registrationField] || "").trim();

            // Registration for this loan type already exists
            if (
                existingRegistration &&
                existingRegistration !== "N/A"
            ) {
                return NextResponse.json(
                    {
                        error: "User registration already exists.",
                        registrationNo: existingRegistration,
                    },
                    { status: 409 }
                );
            }

            // --------------------------------------------------
            // Existing customer + empty registration field
            //
            // IMPORTANT:
            // Ignore every other submitted field.
            // Only add the new registration number.
            // --------------------------------------------------

            await customerRef.update({
                [registrationField]: cleanRegNo,
            });

            return NextResponse.json(
                {
                    success: true,
                    action: "registration-added",
                    nic: cleanNic,
                    registrationNo: cleanRegNo,
                    registrationField,
                    message: "New registration number added successfully.",
                },
                { status: 200 }
            );
        }

        // --------------------------------------------------
        // NEW CUSTOMER
        // --------------------------------------------------

        const auditValue =
            currentUser.role === "developer"
                ? "system"
                : currentUser.role || "system";

        await customerRef.set({
            nic: cleanNic,

            fullName: String(fullName || "").trim(),
            contact: String(contact || "").trim(),
            permanentAddress: String(permanentAddress || "").trim(),

            businessType: String(businessType || "").trim(),
            businessRegNo: String(businessRegNo || "").trim(),
            businessAddress: String(businessAddress || "").trim(),

            loanPurpose: String(loanPurpose || "").trim(),
            routeToHouse: String(routeToHouse || "").trim(),

            // Registration numbers
            dailyRegNo:
                normalizedCreditType === "daily"
                    ? cleanRegNo
                    : "",

            weeklyRegNo:
                normalizedCreditType === "weekly"
                    ? cleanRegNo
                    : "",

            monthlyRegNo:
                normalizedCreditType === "monthly"
                    ? cleanRegNo
                    : "",

            MintRegNo:
                normalizedCreditType === "mint"
                    ? cleanRegNo
                    : "",

            chqRegNo:
                normalizedCreditType === "chq"
                    ? cleanRegNo
                    : "",

            loyalty: String(loyalty || "").trim(),
            status: String(status || "active").trim(),

            createdAt: new Date(),
            createdBy: auditValue,

            updatedAt: "N/A",
            updatedBy: "N/A",
        });

        return NextResponse.json(
            {
                success: true,
                action: "customer-created",
                nic: cleanNic,
                registrationNo: cleanRegNo,
                registrationField,
                message: "Customer registered successfully.",
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Customer creation error:", error);

        return NextResponse.json(
            { error: "Unable to register customer." },
            { status: 500 }
        );
    }
}