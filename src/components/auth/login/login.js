"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    signInWithEmailAndPassword,
    getIdToken,
} from "firebase/auth";

import { auth } from "@/lib/firebase/client";

export default function Login() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();

        setError("");

        if (!email.trim()) {
            setError("Please enter your email address.");
            return;
        }

        if (!password) {
            setError("Please enter your password.");
            return;
        }

        try {
            setLoading(true);

            // 1. Sign in through Firebase Authentication
            const userCredential =
                await signInWithEmailAndPassword(
                    auth,
                    email.trim(),
                    password
                );

            // 2. Get Firebase ID token
            const idToken = await getIdToken(
                userCredential.user,
                true
            );

            // 3. Send token to our Next.js server
            const response = await fetch(
                "/api/auth/session",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ idToken }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to create session."
                );
            }

            // 4. Login successful
            router.push("/dashboard");
        } catch (error) {
            console.error("Login error:", error);

            switch (error.code) {
                case "auth/invalid-credential":
                case "auth/wrong-password":
                case "auth/user-not-found":
                    setError("Invalid email or password.");
                    break;

                case "auth/invalid-email":
                    setError("Please enter a valid email address.");
                    break;

                case "auth/too-many-requests":
                    setError(
                        "Too many login attempts. Please try again later."
                    );
                    break;

                case "auth/network-request-failed":
                    setError(
                        "Network error. Please check your connection."
                    );
                    break;

                default:
                    setError(
                        error.message || "Unable to sign in."
                    );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* 
              Keep your existing login UI here.
              We will connect your existing JSX to:
              
              email
              setEmail
              password
              setPassword
              showPassword
              setShowPassword
              error
              loading
              handleLogin
            */}
        </div>
    );
}