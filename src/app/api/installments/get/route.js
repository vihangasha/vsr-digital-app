
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: "Unauthorized. Please log in." },
                { status: 401 }
            );
        }

        const snapshot = await adminDb
            .collection("installments")
            .orderBy("createdAt", "desc")
            .limit(100)
            .get();

        const installments = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({
            success: true,
            installments,
        });
    } catch (error) {
        console.error("Get installments error:", error);

        return NextResponse.json(
            { error: "Failed to retrieve installments." },
            { status: 500 }
        );
    }
}
