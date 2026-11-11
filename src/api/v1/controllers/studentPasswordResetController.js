import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../../../utils/db.mjs";
import emailService from "../../../services/emailService2.js";
import { revokeUserSessions } from "../../../utils/sessionRevocation.js";

/*
 * Student forgot-password.
 * - Students identify themselves by registration number (not email: emails aren't unique).
 *   An unknown or deactivated registration number is reported as such (product decision).
 * - The emailed token is 32 random bytes; only its SHA-256 is stored. 30 minutes, single use,
 *   and a new request replaces the previous link.
 * - Per account: one request every 2 minutes, at most 5 a day (admin-sent links included).
 */

const TOKEN_TTL_MINUTES = 30;
const REQUEST_COOLDOWN_MS = 2 * 60 * 1000;
const MAX_REQUESTS_PER_DAY = 5;
const MIN_PASSWORD_LENGTH = 8;

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);
const studentPortalUrl = () => (process.env.STUDENT_CLIENT_URL || "https://drims.umi.ac.ug").replace(/\/+$/, "");

const SENT_MESSAGE = "A password reset link has been sent to the email on your account.";
const NOT_FOUND_MESSAGE = "No student account was found with that registration number. Check it and try again.";
const DEACTIVATED_MESSAGE = "This student account has been deactivated. Please contact the administrator.";

/** j***@gmail.com */
export const maskEmail = (email) => {
  const [local = "", domain = ""] = String(email || "").split("@");
  if (!local || !domain) return null;
  return `${local[0]}***@${domain}`;
};

/** Exact registration-number match, ignoring case and surrounding spaces. */
const findByRegistrationNumber = (registrationNumber) =>
  prisma.studentUser.findFirst({
    where: { registrationNumber: { equals: registrationNumber, mode: "insensitive" } },
    select: {
      id: true, fullName: true, email: true, registrationNumber: true, isActive: true,
      passwordResetRequestedAt: true, passwordResetRequestDay: true, passwordResetRequestCount: true,
    },
  });

/** Returns null when another request is allowed, else the reason it isn't. */
const requestLimitReason = (studentUser, now = new Date()) => {
  if (studentUser.passwordResetRequestedAt && now - studentUser.passwordResetRequestedAt < REQUEST_COOLDOWN_MS) {
    return "COOLDOWN";
  }
  const count = studentUser.passwordResetRequestDay === today() ? studentUser.passwordResetRequestCount || 0 : 0;
  return count >= MAX_REQUESTS_PER_DAY ? "DAILY_LIMIT" : null;
};

const resetEmailHtml = ({ name, link, sentByAdmin }) => `
  <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #23388F; color: white; padding: 12px; text-align: center;"><h2 style="margin: 0;">Reset your DRIMS password</h2></div>
      <div style="padding: 20px; border: 1px solid #ddd;">
        <p>Hello ${name},</p>
        <p>${sentByAdmin
          ? "A DRIMS administrator has sent you a link to set a new password for your student account."
          : "We received a request to reset the password for your DRIMS student account."}</p>
        <p>This link works once and expires in ${TOKEN_TTL_MINUTES} minutes.</p>
        <p><a href="${link}" style="display: inline-block; background-color: #23388F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Set a new password</a></p>
        <p>If the button doesn't work, copy this link into your browser:<br>${link}</p>
        <p>If you didn't ask for this, you can ignore this email; your password stays the same.</p>
      </div>
      <p style="font-size: 12px; text-align: center; color: #777;">Uganda Management Institute · DRIMS. This is an automated message; please don't reply.</p>
    </div>
  </body></html>`;

const changedEmailHtml = ({ name }) => `
  <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #23388F; color: white; padding: 12px; text-align: center;"><h2 style="margin: 0;">Your DRIMS password was changed</h2></div>
      <div style="padding: 20px; border: 1px solid #ddd;">
        <p>Hello ${name},</p>
        <p>The password for your DRIMS student account was just changed, and you have been signed out on all devices.</p>
        <p><strong>If this wasn't you,</strong> contact the DRIMS support team immediately using the support chat on the student portal.</p>
      </div>
    </div>
  </body></html>`;

/**
 * Issue a new reset link for a student and email it. Replaces any earlier link.
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'COOLDOWN'|'DAILY_LIMIT'|'NO_EMAIL'|'EMAIL_FAILED' }>}
 */
const issueResetLink = async (studentUser, { sentByAdmin = false } = {}) => {
  const limit = requestLimitReason(studentUser);
  if (limit) return { ok: false, reason: limit };
  if (!studentUser.email) return { ok: false, reason: "NO_EMAIL" };

  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const sameDay = studentUser.passwordResetRequestDay === today();
  await prisma.studentUser.update({
    where: { id: studentUser.id },
    data: {
      passwordResetTokenHash: sha256(token),
      passwordResetExpiresAt: new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000),
      passwordResetRequestedAt: now,
      passwordResetRequestDay: today(),
      passwordResetRequestCount: (sameDay ? studentUser.passwordResetRequestCount || 0 : 0) + 1,
    },
    select: { id: true },
  });

  const link = `${studentPortalUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await emailService.sendEmail({
      to: studentUser.email,
      subject: "Reset your DRIMS password",
      htmlContent: resetEmailHtml({ name: studentUser.fullName, link, sentByAdmin }),
    });
  } catch (error) {
    console.error("Password reset email failed:", error?.message);
    return { ok: false, reason: "EMAIL_FAILED" };
  }
  return { ok: true };
};

const logActivity = (data, req) =>
  prisma.userActivity
    .create({
      data: {
        ...data,
        ipAddress: req.headers["x-client-ip"] || req.ip || "Unknown",
        deviceId: req.headers["x-device-id"] || "Unknown",
        browserAgent: req.headers["user-agent"] || "Unknown",
      },
    })
    .catch((error) => console.error("Failed to log password reset activity:", error?.message));

/** Rules for a new student password; returns an error message or null. */
export const passwordProblem = (password, studentUser) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  const lower = password.toLowerCase();
  const regNo = String(studentUser.registrationNumber || "").toLowerCase();
  const regDigits = regNo.split("/").pop().replace(/[^0-9]/g, "");
  if ((regNo && lower.includes(regNo)) || (regDigits.length >= 4 && lower.includes(regDigits))) {
    return "Password must not contain your registration number.";
  }
  // The pattern new accounts are given by default: first name + registration digits
  const firstName = String(studentUser.fullName || "").trim().split(/\s+/)[0].toLowerCase();
  if (firstName && lower === `${firstName}${regDigits}`) {
    return "Choose a password other than your original one.";
  }
  return null;
};

/** POST /api/v1/student/request-password-reset  { registrationNumber } */
export const requestStudentPasswordReset = async (req, res, next) => {
  try {
    const registrationNumber = typeof req.body?.registrationNumber === "string" ? req.body.registrationNumber.trim() : "";
    if (!registrationNumber || registrationNumber.length > 60) {
      return res.status(400).json({ message: "Enter your registration number." });
    }

    const studentUser = await findByRegistrationNumber(registrationNumber);
    if (!studentUser) {
      return res.status(404).json({ message: NOT_FOUND_MESSAGE });
    }
    if (studentUser.isActive === false) {
      return res.status(403).json({ message: DEACTIVATED_MESSAGE });
    }

    const maskedEmail = maskEmail(studentUser.email);
    const result = await issueResetLink(studentUser);
    if (!result.ok && result.reason === "COOLDOWN") {
      return res.status(200).json({
        message: "A reset link was sent a moment ago. Check your inbox and spam folder, or try again in a few minutes.",
        maskedEmail,
      });
    }
    if (!result.ok && result.reason === "DAILY_LIMIT") {
      return res.status(429).json({
        message: "Too many reset requests for this account today. Try again tomorrow or contact support.",
      });
    }

    await logActivity({
      studentUserId: studentUser.id,
      action: "Password Reset Requested",
      entityType: "StudentUser",
      entityId: studentUser.id,
      details: JSON.stringify({ emailed: result.ok, reason: result.ok ? undefined : result.reason }),
    }, req);

    if (!result.ok && result.reason === "NO_EMAIL") {
      return res.status(409).json({
        message: "Your account has no email address on file, so we can't send a reset link. Open the support chat and we'll help you.",
      });
    }
    if (!result.ok && result.reason === "EMAIL_FAILED") {
      return res.status(502).json({
        message: "We couldn't send the reset email just now. Please try again in a few minutes.",
      });
    }

    res.status(200).json({ message: SENT_MESSAGE, maskedEmail });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

/** POST /api/v1/student/reset-password  { token, newPassword } */
export const resetStudentPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    if (typeof token !== "string" || token.length < 20 || token.length > 200) {
      return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new one." });
    }

    const studentUser = await prisma.studentUser.findFirst({
      where: { passwordResetTokenHash: sha256(token), passwordResetExpiresAt: { gt: new Date() } },
      select: { id: true, fullName: true, email: true, registrationNumber: true, isActive: true },
    });
    if (!studentUser || studentUser.isActive === false) {
      return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new one." });
    }

    const problem = passwordProblem(newPassword, studentUser);
    if (problem) return res.status(400).json({ message: problem });

    await prisma.studentUser.update({
      where: { id: studentUser.id },
      data: {
        password: await bcrypt.hash(newPassword, 12),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
      select: { id: true },
    });

    // Every existing login for this account stops working
    await revokeUserSessions(studentUser.id, "PASSWORD_RESET");

    await logActivity({
      studentUserId: studentUser.id,
      action: "Password Reset Completed",
      entityType: "StudentUser",
      entityId: studentUser.id,
    }, req);

    emailService
      .sendEmail({ to: studentUser.email, subject: "Your DRIMS password was changed", htmlContent: changedEmailHtml({ name: studentUser.fullName }) })
      .catch((error) => console.error("Password changed email failed:", error?.message));

    res.status(200).json({ message: "Your password has been changed. Sign in with your new password." });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

/** POST /api/v1/management/students/:studentId/send-password-reset  (SUPERADMIN, RESEARCH_ADMIN) */
export const adminSendStudentPasswordReset = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.studentId },
      select: { studentUserId: true },
    });
    if (!student?.studentUserId) {
      return res.status(404).json({ message: "This student has no portal account." });
    }
    const studentUser = await prisma.studentUser.findUnique({
      where: { id: student.studentUserId },
      select: {
        id: true, fullName: true, email: true, registrationNumber: true, isActive: true,
        passwordResetRequestedAt: true, passwordResetRequestDay: true, passwordResetRequestCount: true,
      },
    });
    if (!studentUser) return res.status(404).json({ message: "This student has no portal account." });
    if (studentUser.isActive === false) {
      return res.status(409).json({ message: "This student's account is deactivated. Reactivate it first." });
    }

    const result = await issueResetLink(studentUser, { sentByAdmin: true });
    if (!result.ok) {
      const messages = {
        COOLDOWN: "A reset link was sent less than 2 minutes ago. Wait a moment before sending another.",
        DAILY_LIMIT: "This account has reached the limit of 5 reset links today.",
        NO_EMAIL: "This student has no email address on file. Add one, or set a password manually.",
        EMAIL_FAILED: "The reset email could not be sent. Try again, or set a password manually.",
      };
      return res.status(result.reason === "EMAIL_FAILED" ? 502 : 409).json({ message: messages[result.reason] });
    }

    await logActivity({
      userId: req.user.id,
      action: "Sent Student Password Reset Link",
      entityType: "StudentUser",
      entityId: studentUser.id,
      details: JSON.stringify({ registrationNumber: studentUser.registrationNumber }),
    }, req);

    res.status(200).json({
      message: `Reset link sent to ${maskEmail(studentUser.email)}. It expires in ${TOKEN_TTL_MINUTES} minutes.`,
      maskedEmail: maskEmail(studentUser.email),
    });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};
