import crypto from 'crypto';
import prisma from './db.mjs';

// Roles that manage every ticket (mirrors the management routes in ticketRoutes.js).
export const TICKET_ADMIN_ROLES = ['SUPERADMIN', 'MANAGER'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** New guest access key: the plaintext goes to the guest once, only the hash is stored. */
export const createGuestAccessToken = () => {
    const token = crypto.randomBytes(32).toString('base64url');
    return { token, hash: sha256(token) };
};

/** Loads a ticket including its guest key hash (omitted from normal queries). */
export const findTicketForAccessCheck = (id) => {
    if (!/^[a-f0-9]{24}$/i.test(String(id || ''))) return null;
    return prisma.ticket.findUnique({
        where: { id },
        omit: { guestAccessTokenHash: false },
    });
};

/**
 * Who may read or post to a ticket:
 * - ticket admins: any ticket
 * - signed-in users: tickets they created
 * - guests: tickets whose access key they hold
 * @param {object} ticket - from findTicketForAccessCheck
 * @param {{ id: string, role?: string, isStudentUser?: boolean } | null} user - verified JWT payload
 * @param {string | undefined} guestToken
 */
export const canAccessTicket = (ticket, user, guestToken) => {
    if (!ticket) return false;
    if (user) {
        if (TICKET_ADMIN_ROLES.includes(user.role)) return true;
        return user.isStudentUser ? ticket.creatorStudentId === user.id : ticket.creatorUserId === user.id;
    }
    if (!guestToken || !ticket.guestAccessTokenHash) return false;
    const given = Buffer.from(sha256(String(guestToken)), 'hex');
    const stored = Buffer.from(ticket.guestAccessTokenHash, 'hex');
    return given.length === stored.length && crypto.timingSafeEqual(given, stored);
};
