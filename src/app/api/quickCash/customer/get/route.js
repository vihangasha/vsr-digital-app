
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

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
        // Read and validate NIC
        // --------------------------------------------------

        const body = await request.json();

        const nic = String(body?.nic || "").trim();

        if (!nic) {
            return NextResponse.json(
                { error: "NIC is required." },
                { status: 400 }
            );
        }

        // --------------------------------------------------
        // Find customer directly using NIC as document ID
        // --------------------------------------------------

        const customerRef = adminDb
            .collection("customers")
            .doc(nic);

        const customerSnapshot = await customerRef.get();

        if (!customerSnapshot.exists) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Customer not found.",
                },
                { status: 404 }
            );
        }

        const customerData = customerSnapshot.data();

        // --------------------------------------------------
        // Read customer details
        // --------------------------------------------------

        const fullName = String(
            customerData.fullName || ""
        ).trim();

        const existingChqRegNo = String(
            customerData.chqRegNo || ""
        ).trim().toUpperCase();

        // Treat empty or N/A as unassigned
        const hasChqRegNo =
            existingChqRegNo !== "" &&
            existingChqRegNo !== "N/A";

        // --------------------------------------------------
        // Response
        // --------------------------------------------------

        return NextResponse.json(
            {
                success: true,
                customer: {
                    nic,
                    name: fullName,
                    chqRegNo: hasChqRegNo
                        ? existingChqRegNo
                        : null,
                    needsChqRegNo: !hasChqRegNo,
                },
            },
            { status: 200 }
        );

    } catch (error) {
        console.error(
            "Quick Cash customer lookup error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                error: "Unable to fetch customer details.",
            },
            { status: 500 }
        );
    }
}
