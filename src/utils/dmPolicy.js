import prisma from './db.mjs';

export const DM_NOT_ALLOWED_MESSAGE = 'Direct messages are only available between students and their assigned supervisors.';

/**
 * Direct messages are allowed only between a student and a supervisor assigned to them.
 * "Assigned" uses the same relation as the messaging contact lists
 * (student.supervisors, see listAllSupervisorsForMessaging / listAllStudentsForMessaging).
 * @param {string} idA - studentUser id or user id
 * @param {string} idB - studentUser id or user id
 */
export const canDirectMessage = async (idA, idB) => {
    if (!idA || !idB || idA === idB) return false;
    const pair = (studentUserId, supervisorUserId) => ({
        studentUserId,
        supervisors: { some: { userId: supervisorUserId, user: { role: 'SUPERVISOR' } } },
    });
    const match = await prisma.student.findFirst({
        where: { OR: [pair(idA, idB), pair(idB, idA)] },
        select: { id: true },
    });
    return Boolean(match);
};
