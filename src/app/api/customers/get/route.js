
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

// Convert Firestore Timestamps into JSON-safe values.
function serializeValue(value) {
    if (value == null) return value;

    if (typeof value.toDate === "function") {
        return value.toDate().toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(serializeValue);
    }

    if (typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                serializeValue(item),
            ])
        );
    }

    return value;
}

export async function GET() {
    try {
        // Require an authenticated session.
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { success: false, error: "Unauthorized." },
                { status: 401 }
            );
        }

        // Retrieve every customer document.
        const snapshot = await adminDb.collection("customers").get();

        // Exclude the placeholder/test customer document.
        const customers = snapshot.docs
            .filter((doc) => doc.id !== "nic")
            .map((doc) => {

                const data = doc.data();

                return serializeValue({
                    ...data,

                    // The customer document ID is the NIC.
                    id: doc.id,
                    nic: data.nic || doc.id,

                    // Keep these available even for older documents.
                    fullName: data.fullName ?? "",
                    contact: data.contact ?? "",
                    permanentAddress: data.permanentAddress ?? "",
                    businessType: data.businessType ?? "",
                    businessRegNo: data.businessRegNo ?? "",
                    businessAddress: data.businessAddress ?? "",
                    loanPurpose: data.loanPurpose ?? "",
                    routeToHouse: data.routeToHouse ?? "",

                    dailyRegNo: data.dailyRegNo ?? "",
                    weeklyRegNo: data.weeklyRegNo ?? "",
                    monthlyRegNo: data.monthlyRegNo ?? "",
                    MintRegNo: data.MintRegNo ?? "",
                    chqRegNo: data.chqRegNo ?? "",

                    loyalty: data.loyalty ?? "",
                    status: data.status ?? "",

                    createdAt: data.createdAt ?? null,
                    createdBy: data.createdBy ?? "",
                    updatedAt: data.updatedAt ?? null,
                    updatedBy: data.updatedBy ?? "",
                });
            });

        // Alphabetical order, without requiring every document
        // to have a fullName field in Firestore.
        customers.sort((a, b) =>
            a.fullName.localeCompare(b.fullName)
        );

        return NextResponse.json(
            {
                success: true,
                count: customers.length,
                customers,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("Get customers error:", error);

        return NextResponse.json(
            {
                success: false,
                error: "Failed to retrieve customers.",
            },
            { status: 500 }
        );
    }
}
