import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getCurrentUser, getCreatedBy } from "@/lib/auth/session";

export async function POST(request) {
    let createdAuthUser = null;

    try {
        // --------------------------------------------------
        // 1. Check the currently logged-in user
        // --------------------------------------------------

        const currentUser = await getCurrentUser();

        if (!currentUser) {
            return NextResponse.json(
                {
                    error: "Unauthorized.",
                },
                {
                    status: 401,
                }
            );
        }

        // --------------------------------------------------
        // 2. Check permission
        //
        // Developer = highest authority
        // Admin    = administrative authority
        // Agent    = cannot create users
        // --------------------------------------------------

        if (
            currentUser.role !== "developer" &&
            currentUser.role !== "admin"
        ) {
            return NextResponse.json(
                {
                    error:
                        "You do not have permission to create users.",
                },
                {
                    status: 403,
                }
            );
        }

        // --------------------------------------------------
        // 3. Read request body
        // --------------------------------------------------

        const body = await request.json();

        const {
            name,
            email,
            password,
            role,
        } = body;

        // --------------------------------------------------
        // 4. Validate required fields
        // --------------------------------------------------

        if (!name || !email || !password || !role) {
            return NextResponse.json(
                {
                    error:
                        "Name, email, password and role are required.",
                },
                {
                    status: 400,
                }
            );
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (!cleanName) {
            return NextResponse.json(
                {
                    error: "Name cannot be empty.",
                },
                {
                    status: 400,
                }
            );
        }

        // --------------------------------------------------
        // 5. Validate role
        // --------------------------------------------------

        const allowedRoles = [
            "admin",
            "developer",
            "agent",
        ];

        if (!allowedRoles.includes(role)) {
            return NextResponse.json(
                {
                    error: "Invalid user role.",
                },
                {
                    status: 400,
                }
            );
        }

        // --------------------------------------------------
        // 6. Create Firebase Authentication account
        // --------------------------------------------------

        createdAuthUser = await adminAuth.createUser({
            email: cleanEmail,
            password,
            displayName: cleanName,
        });

        // --------------------------------------------------
        // 7. Create Firestore user profile
        // --------------------------------------------------

        const createdBy = getCreatedBy(currentUser);

        await adminDb
            .collection("users")
            .doc(createdAuthUser.uid)
            .set({
                userID: createdAuthUser.uid,
                name: cleanName,
                email: cleanEmail,
                role,
                status: "Active",

                createdAt: FieldValue.serverTimestamp(),
                createdBy,

                updatedBy: "N/A",
            });

        // --------------------------------------------------
        // 8. Return successful response
        // --------------------------------------------------

        return NextResponse.json(
            {
                success: true,

                user: {
                    uid: createdAuthUser.uid,
                    name: cleanName,
                    email: cleanEmail,
                    role,
                    status: "Active",
                    createdBy,
                },
            },
            {
                status: 201,
            }
        );

    } catch (error) {
        console.error("User creation error:", error);

        // --------------------------------------------------
        // 9. Roll back Firebase Authentication account
        //
        // If Auth was created but Firestore failed,
        // remove the Auth account so we don't leave
        // an incomplete/orphaned user behind.
        // --------------------------------------------------

        if (createdAuthUser?.uid) {
            try {
                await adminAuth.deleteUser(
                    createdAuthUser.uid
                );
            } catch (rollbackError) {
                console.error(
                    "Failed to rollback Firebase Auth user:",
                    rollbackError
                );
            }
        }

        // --------------------------------------------------
        // 10. Handle known Firebase errors
        // --------------------------------------------------

        if (error.code === "auth/email-already-exists") {
            return NextResponse.json(
                {
                    error:
                        "A user with this email already exists.",
                },
                {
                    status: 409,
                }
            );
        }

        if (error.code === "auth/invalid-email") {
            return NextResponse.json(
                {
                    error: "Invalid email address.",
                },
                {
                    status: 400,
                }
            );
        }

        if (
            error.code ===
            "auth/password-does-not-meet-requirements"
        ) {
            return NextResponse.json(
                {
                    error:
                        "The password does not meet the required security rules.",
                },
                {
                    status: 400,
                }
            );
        }

        // --------------------------------------------------
        // 11. Generic server error
        // --------------------------------------------------

        return NextResponse.json(
            {
                error: "Unable to create user.",
            },
            {
                status: 500,
            }
        );
    }
}