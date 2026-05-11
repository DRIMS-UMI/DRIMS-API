/**
 * Validates whether a student can transition to a new status based on stepOrder.
 * 
 * @param {Object} currentStatusDef - The status definition of the student's current status
 * @param {Object} newStatusDef - The status definition the student is trying to transition to
 * @throws {Error} If the transition skips a sequential step
 */
export const validateStatusTransition = (currentStatusDef, newStatusDef) => {
    // If either status lacks a stepOrder, or if the new status is a failure loopback,
    // we do not strictly enforce forward progression.
    if (!currentStatusDef || !newStatusDef) return;
    if (currentStatusDef.stepOrder == null || newStatusDef.stepOrder == null) return;
    if (newStatusDef.isFailure) return;

    // Administrative and terminal statuses are exempt from sequential validation
    const administrativeStatuses = ['deregistered', 'graduated', 'withdrawn', 'deceased', 'suspended'];
    if (administrativeStatuses.includes(newStatusDef.name.toLowerCase())) return;

    // The golden rule: A student cannot skip forward.
    // They can stay on the same step, go backwards (loopbacks), or go to the immediate next step (+1).
    if (newStatusDef.stepOrder > currentStatusDef.stepOrder + 1) {
        const error = new Error(`Action denied: Cannot skip to "${newStatusDef.name}". The student must complete intermediate steps first.`);
        error.statusCode = 400;
        throw error;
    }
};
