
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const EDITABLE_FIELDS = [
    "fullName",
    "contact",
    "permanentAddress",
    "businessType",
    "businessRegNo",
    "businessAddress",
    "loanPurpose",
    "routeToHouse",
    "status",
    "loyalty",
];

const MAX_FIELD_LENGTH = 1000;

export async function PUT(request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Unauthorized." },
                { status: 401 }
            );
        }

        const body = await request.json();
        const nic = String(body.nic || "").trim();

        if (!nic) {
            return NextResponse.json(
                { success: false, error: "Customer NIC is required." },
                { status: 400 }
            );
        }

        const updates = {};

        for (const field of EDITABLE_FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(body, field)) {
                continue;
            }

            const value = body[field];

            if (value !== null && typeof value !== "string") {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Invalid value for ${field}.`,
                    },
                    { status: 400 }
                );
            }

            const cleanedValue = value === null ? "" : value.trim();

            if (cleanedValue.length > MAX_FIELD_LENGTH) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `${field} exceeds the maximum allowed length.`,
                    },
                    { status: 400 }
                );
            }

            updates[field] = cleanedValue;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { success: false, error: "No editable fields were supplied." },
                { status: 400 }
            );
        }

        const customerRef = adminDb.collection("customers").doc(nic);

        const customerSnapshot = await customerRef.get();

        if (!customerSnapshot.exists) {
            return NextResponse.json(
                { success: false, error: "Customer not found." },
                { status: 404 }
            );
        }

        // Update only the explicitly permitted fields.
        // Registration numbers and system fields remain untouched.
        await customerRef.update({
            ...updates,
            updatedAt: FieldValue.serverTimestamp(),
        });

        return NextResponse.json({
            success: true,
            message: "Customer updated successfully.",
            updatedFields: Object.keys(updates),
        });
    } catch (error) {
        console.error("Customer update API error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Unable to update customer details.",
            },
            { status: 500 }
        );
    }
}
