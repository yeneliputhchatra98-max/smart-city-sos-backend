const dns = require("dns");
const nodemailer = require("nodemailer");

dns.setDefaultResultOrder("ipv4first");

const smtpPort = Number.parseInt(process.env.SMTP_PORT || "587", 10);
const smtpSecure = process.env.SMTP_SECURE === "true" || smtpPort === 465;
const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER;
const emailProvider = (
    process.env.EMAIL_PROVIDER ||
    (process.env.RESEND_API_KEY ? "resend" : "smtp")
).toLowerCase();

const smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: process.env.SMTP_REQUIRE_TLS === "true" || (!smtpSecure && smtpPort === 587),
    family: 4,

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },

    connectionTimeout: Number.parseInt(process.env.SMTP_CONNECTION_TIMEOUT || "10000", 10),
    greetingTimeout: Number.parseInt(process.env.SMTP_GREETING_TIMEOUT || "10000", 10),
    socketTimeout: Number.parseInt(process.env.SMTP_SOCKET_TIMEOUT || "10000", 10),
});

const sendEmail = async ({ to, subject, html }) => {
    if (emailProvider === "resend") {
        if (!process.env.RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY is not configured");
        }

        if (!process.env.EMAIL_FROM) {
            throw new Error("EMAIL_FROM is not configured");
        }

        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: emailFrom,
                to: [to],
                subject,
                html,
            }),
        });

        if (!response.ok) {
            const details = await response.text();
            throw new Error(`Resend API ${response.status}: ${details}`);
        }

        return;
    }

    if (emailProvider !== "smtp") {
        throw new Error("EMAIL_PROVIDER must be either resend or smtp");
    }

    await smtpTransporter.sendMail({
        from: `"Smart City SOS Cambodia" <${emailFrom}>`,
        to,
        subject,
        html,
    });
};

const sendPasswordResetEmail = async (email, resetUrl) => {
    await sendEmail({
        to: email,
        subject: "🔐 Reset Your Smart City SOS Password",

        html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
</head>

<body style="
    margin:0;
    padding:0;
    background:#f4f7fb;
    font-family:Arial, Helvetica, sans-serif;
">

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="background:#f4f7fb; padding:40px 15px;">

        <tr>
            <td align="center">

                <!-- Main Card -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0"
                    style="
                        max-width:560px;
                        background:#ffffff;
                        border-radius:20px;
                        overflow:hidden;
                        box-shadow:0 10px 35px rgba(15,23,42,0.10);
                    ">

                    <!-- Header -->
                    <tr>
                        <td align="center"
                            style="
                                background:linear-gradient(
                                    135deg,
                                    #0A1424 0%,
                                    #172A46 100%
                                );
                                padding:35px 30px;
                            ">

                            <!-- Icon -->
                            <div style="
                                width:64px;
                                height:64px;
                                line-height:64px;
                                margin:0 auto 15px;
                                background:#E4572E;
                                border-radius:50%;
                                font-size:30px;
                            ">
                                🔐
                            </div>

                            <h1 style="
                                margin:0;
                                color:#ffffff;
                                font-size:24px;
                                font-weight:700;
                            ">
                                Smart City SOS
                            </h1>

                            <p style="
                                margin:8px 0 0;
                                color:#B8C4D6;
                                font-size:14px;
                            ">
                                Cambodia
                            </p>

                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding:40px 38px 30px;">

                            <h2 style="
                                margin:0 0 15px;
                                color:#0A1424;
                                font-size:23px;
                            ">
                                Reset your password
                            </h2>

                            <p style="
                                margin:0 0 18px;
                                color:#536174;
                                font-size:15px;
                                line-height:1.7;
                            ">
                                We received a request to reset the password
                                for your Smart City SOS Cambodia account.
                            </p>

                            <p style="
                                margin:0 0 28px;
                                color:#536174;
                                font-size:15px;
                                line-height:1.7;
                            ">
                                Click the button below to create a new
                                password and get back into your account.
                            </p>

                            <!-- Button -->
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">

                                        <a href="${resetUrl}"
                                            style="
                                                display:inline-block;
                                                padding:14px 30px;
                                                background:#E4572E;
                                                color:#ffffff;
                                                text-decoration:none;
                                                border-radius:10px;
                                                font-size:15px;
                                                font-weight:bold;
                                                box-shadow:0 5px 15px rgba(228,87,46,0.25);
                                            ">
                                            🔑 &nbsp; Reset Password
                                        </a>

                                    </td>
                                </tr>
                            </table>

                            <!-- Expiration -->
                            <div style="
                                margin-top:30px;
                                padding:16px;
                                background:#fff7f3;
                                border:1px solid #ffe0d5;
                                border-radius:10px;
                            ">

                                <p style="
                                    margin:0;
                                    color:#B94A2C;
                                    font-size:13px;
                                    line-height:1.6;
                                ">
                                    ⏱️ <strong>This link expires in 15 minutes.</strong>
                                    <br>
                                    For your security, this link can only be
                                    used once.
                                </p>

                            </div>

                            <p style="
                                margin:25px 0 0;
                                color:#8A96A8;
                                font-size:13px;
                                line-height:1.6;
                            ">
                                If you didn't request a password reset,
                                you can safely ignore this email.
                                Your password will remain unchanged.
                            </p>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center"
                            style="
                                background:#f8fafc;
                                border-top:1px solid #edf1f5;
                                padding:22px 30px;
                            ">

                            <p style="
                                margin:0 0 6px;
                                color:#0A1424;
                                font-size:13px;
                                font-weight:bold;
                            ">
                                Smart City SOS Cambodia
                            </p>

                            <p style="
                                margin:0;
                                color:#9AA5B5;
                                font-size:12px;
                            ">
                                Emergency Response & Smart City Platform
                            </p>

                            <p style="
                                margin:12px 0 0;
                                color:#B0B8C5;
                                font-size:11px;
                            ">
                                © ${new Date().getFullYear()}
                                Smart City SOS Cambodia
                            </p>

                        </td>
                    </tr>

                </table>

                <!-- Security Text -->
                <p style="
                    max-width:500px;
                    margin:20px auto 0;
                    text-align:center;
                    color:#9AA5B5;
                    font-size:11px;
                    line-height:1.6;
                ">
                    This is an automated message. Please do not reply
                    directly to this email.
                </p>

            </td>
        </tr>

    </table>

</body>
</html>
        `,
    });
};
const sendVerificationEmail = async (email, verifyUrl) => {
    await sendEmail({
        to: email,
        subject: "📧 Verify Your Smart City SOS Cambodia Email",
        html: `
            <h2>Verify your email</h2>

            <p>
                Thank you for registering with Smart City SOS Cambodia.
            </p>

            <p>
                Please click the button below to verify your email address.
            </p>

            <p>
                <a href="${verifyUrl}">
                    ✅ Verify Email
                </a>
            </p>

            <p>
                This verification link expires in 24 hours.
            </p>

            <p>
                If you did not create this account, you can safely ignore this email.
            </p>
        `,
    });
};
module.exports = {
    sendPasswordResetEmail,
    sendVerificationEmail,
};