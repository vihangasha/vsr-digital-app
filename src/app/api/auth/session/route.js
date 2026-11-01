import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { adminAuth, adminDb } from "@/lib/firebase/admin";

const SESSION_EXPIRES_IN = 1000 * 60 * 60 * 24 * 5; // 5 days

export async function POST(request) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json(
                { error: "ID token is required." },
                { status: 400 }
            );
        }

        const decodedToken = await adminAuth.verifyIdToken(idToken);

        const sessionCookie = await adminAuth.createSessionCookie(
            idToken,
            {
                expiresIn: SESSION_EXPIRES_IN,
            }
        );

        const response = NextResponse.json({
            success: true,
            uid: decodedToken.uid,
        });

        response.cookies.set("vsr_session", sessionCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: SESSION_EXPIRES_IN / 1000,
        });

        return response;

    } catch (error) {
        console.error("Session creation error:", error);

        return NextResponse.json(
            { error: "Unable to create session." },
            { status: 401 }
        );
    }
}


// --------------------------------------------------
// GET
// Check the current session
// --------------------------------------------------

export async function GET() {
    try {
        const cookieStore = await cookies();

        const sessionCookie =
            cookieStore.get("vsr_session")?.value;

        if (!sessionCookie) {
            return NextResponse.json(
                {
                    authenticated: false,
                },
                {
                    status: 401,
                }
            );
        }

        const decodedToken =
            await adminAuth.verifySessionCookie(
                sessionCookie,
                true
            );

        const userDoc = await adminDb
            .collection("users")
            .doc(decodedToken.uid)
            .get();

        if (!userDoc.exists) {
            return NextResponse.json(
                {
                    authenticated: false,
                },
                {
                    status: 401,
                }
            );
        }

        const userData = userDoc.data();

        return NextResponse.json({
            authenticated: true,

            user: {
                uid: decodedToken.uid,
                email: decodedToken.email || null,
                name: userData.name || null,
                role: userData.role || null,
            },
        });

    } catch (error) {
        console.error("Session check error:", error);

        return NextResponse.json(
            {
                authenticated: false,
            },
            {
                status: 401,
            }
        );
    }
}

// --------------------------------------------------
// DELETE
// Destroy the current session
// --------------------------------------------------

export async function DELETE() {
    try {
        const response = NextResponse.json({
            success: true,
        });

        response.cookies.set("vsr_session", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 0,
        });

        return response;

    } catch (error) {
        console.error("Session deletion error:", error);

        return NextResponse.json(
            {
                error: "Unable to destroy session.",
            },
            {
                status: 500,
            }
        );
    }
}