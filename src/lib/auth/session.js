import "server-only";

import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const SESSION_COOKIE_NAME = "vsr_session";

export async function getCurrentUser() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

        if (!sessionCookie) {
            return null;
        }

        // Verify the Firebase session cookie
        const decodedToken = await adminAuth.verifySessionCookie(
            sessionCookie,
            true
        );

        // Get the user's application profile from Firestore
        const userDoc = await adminDb
            .collection("users")
            .doc(decodedToken.uid)
            .get();

        if (!userDoc.exists) {
            return null;
        }

        return {
            uid: decodedToken.uid,
            email: decodedToken.email || null,
            name: userDoc.data().name || null,
            role: userDoc.data().role || null,
        };
    } catch (error) {
        console.error("Session verification error:", error);
        return null;
    }
}

/**
 * Label stored in the `createdBy` field when this user creates a record.
 *
 * developer -> "system"
 * admin     -> admin profile name
 * agent     -> null
 */
export function getCreatedBy(user) {
    if (!user) return null;

    if (user.role === "developer") {
        return "system";
    }

    if (user.role === "admin") {
        return user.name || null;
    }

    return null;
}