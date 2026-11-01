import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                { error: "Unauthorized." },
                { status: 401 }
            );
        }

        if (
            currentUser.role !== "developer" &&
            currentUser.role !== "admin"
        ) {
            return NextResponse.json(
                { error: "You do not have permission to view users." },
                { status: 403 }
            );
        }

        const snapshot = await adminDb
            .collection("users")
            .get();

        const users = snapshot.docs.map((doc) => {
            const data = doc.data();

            return {
                uid: doc.id,
                name: data.name || "",
                email: data.email || "",
                role: data.role || "",
                status: "Active",
            };
        });

        return NextResponse.json({
            success: true,
            users,
        });

    } catch (error) {
        console.error("Users fetch error:", error);

        return NextResponse.json(
            { error: "Unable to load users." },
            { status: 500 }
        );
    }
}