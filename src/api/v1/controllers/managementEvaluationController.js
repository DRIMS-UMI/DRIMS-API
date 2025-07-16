import prisma from '../../../utils/db.mjs';
import emailService from '../../../services/emailService.js';
import crypto from 'crypto';
/* ********** STUDENT EVALUATION ANALYTICS ********** */

// Helper function to convert satisfaction enum to number
const satisfactionToNumber = (satisfaction) => {
    switch (satisfaction) {
        case 'VERY_DISSATISFIED': return 1;
        case 'DISSATISFIED': return 2;
        case 'NEUTRAL': return 3;
        case 'SATISFIED': return 4;
        case 'VERY_SATISFIED': return 5;
        default: return 0;
    }
};

// Get evaluation analytics overview
export const getEvaluationAnalytics = async (req, res, next) => {
    try {
        // Get total evaluations count by trigger
        const evaluationsByTrigger = await prisma.studentEvaluation.groupBy({
            by: ['trigger'],
            _count: {
                id: true
            }
        });

        // Get all evaluations for manual average calculation
        const allEvaluations = await prisma.studentEvaluation.findMany({
            select: {
                researchTrainingSatisfaction: true,
                supervisionSatisfaction: true,
                proposalDefenseSatisfaction: true,
                dissertationExaminationSatisfaction: true
            }
        });

        // Calculate averages manually
        const calculateAverage = (evaluations, field) => {
            const validValues = evaluations
                .map(evaluation => satisfactionToNumber(evaluation[field]))
                .filter(val => val > 0);
            return validValues.length > 0 
                ? (validValues.reduce((a, b) => a + b, 0) / validValues.length).toFixed(2)
                : 0;
        };

        const averageRatings = {
            researchTraining: calculateAverage(allEvaluations, 'researchTrainingSatisfaction'),
            supervision: calculateAverage(allEvaluations, 'supervisionSatisfaction'),
            proposalDefense: calculateAverage(allEvaluations, 'proposalDefenseSatisfaction'),
            dissertationExamination: calculateAverage(allEvaluations, 'dissertationExaminationSatisfaction')
        };

        // Get evaluations by month (last 12 months)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const evaluationsTrends = await prisma.studentEvaluation.findMany({
            where: {
                submittedAt: {
                    gte: twelveMonthsAgo
                }
            },
            select: {
                submittedAt: true,
                trigger: true,
                researchTrainingSatisfaction: true,
                supervisionSatisfaction: true,
                proposalDefenseSatisfaction: true,
                dissertationExaminationSatisfaction: true
            },
            orderBy: {
                submittedAt: 'asc'
            }
        });

        // Group by month and calculate averages
        const monthlyTrends = {};
        evaluationsTrends.forEach(evaluation => {
            const date = new Date(evaluation.submittedAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyTrends[monthKey]) {
                monthlyTrends[monthKey] = {
                    month: monthKey,
                    totalEvaluations: 0,
                    researchTrainingAvg: [],
                    supervisionAvg: [],
                    proposalDefenseAvg: [],
                    dissertationExaminationAvg: []
                };
            }
            
            monthlyTrends[monthKey].totalEvaluations++;
            
            monthlyTrends[monthKey].researchTrainingAvg.push(satisfactionToNumber(evaluation.researchTrainingSatisfaction));
            monthlyTrends[monthKey].supervisionAvg.push(satisfactionToNumber(evaluation.supervisionSatisfaction));
            monthlyTrends[monthKey].proposalDefenseAvg.push(satisfactionToNumber(evaluation.proposalDefenseSatisfaction));
            
            if (evaluation.dissertationExaminationSatisfaction) {
                monthlyTrends[monthKey].dissertationExaminationAvg.push(satisfactionToNumber(evaluation.dissertationExaminationSatisfaction));
            }
        });

        // Calculate averages for each month
        const trends = Object.values(monthlyTrends).map(month => {
            const date = new Date(month.month + '-01');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            
            return {
                month: month.month,
                date: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
                totalEvaluations: month.totalEvaluations,
                researchTrainingAvg: month.researchTrainingAvg.length > 0 
                    ? (month.researchTrainingAvg.reduce((a, b) => a + b, 0) / month.researchTrainingAvg.length).toFixed(2)
                    : 0,
                supervisionAvg: month.supervisionAvg.length > 0
                    ? (month.supervisionAvg.reduce((a, b) => a + b, 0) / month.supervisionAvg.length).toFixed(2)
                    : 0,
                proposalDefenseAvg: month.proposalDefenseAvg.length > 0
                    ? (month.proposalDefenseAvg.reduce((a, b) => a + b, 0) / month.proposalDefenseAvg.length).toFixed(2)
                    : 0,
                dissertationExaminationAvg: month.dissertationExaminationAvg.length > 0
                    ? (month.dissertationExaminationAvg.reduce((a, b) => a + b, 0) / month.dissertationExaminationAvg.length).toFixed(2)
                    : 0
            };
        });

        // Get satisfaction distribution
        const satisfactionDistribution = await prisma.studentEvaluation.groupBy({
            by: ['researchTrainingSatisfaction'],
            _count: {
                id: true
            }
        });

        // Get recent evaluations with student details
        const recentEvaluations = await prisma.studentEvaluation.findMany({
            take: 10,
            orderBy: {
                submittedAt: 'desc'
            },
            include: {
                student: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        registrationNumber: true
                    }
                }
            }
        });

        res.status(200).json({
            message: 'Evaluation analytics retrieved successfully',
            data: {
                overview: {
                    totalEvaluations: allEvaluations.length,
                    evaluationsByTrigger: evaluationsByTrigger.map(item => ({
                        trigger: item.trigger,
                        count: item._count.id
                    })),
                    averageRatings
                },
                trends,
                satisfactionDistribution: satisfactionDistribution.map(item => ({
                    level: item.researchTrainingSatisfaction,
                    count: item._count.id
                })),
                recentEvaluations: recentEvaluations.map(evaluation => ({
                    id: evaluation.id,
                    student: {
                        name: `${evaluation.student.firstName} ${evaluation.student.lastName}`,
                        email: evaluation.student.email,
                        studentNumber: evaluation.student.registrationNumber
                    },
                    trigger: evaluation.trigger,
                    submittedAt: evaluation.submittedAt,
                    ratings: {
                        researchTraining: evaluation.researchTrainingSatisfaction,
                        supervision: evaluation.supervisionSatisfaction,
                        proposalDefense: evaluation.proposalDefenseSatisfaction,
                        dissertationExamination: evaluation.dissertationExaminationSatisfaction
                    },
                    hasComments: !!(evaluation.overallComments || evaluation.suggestions)
                }))
            }
        });

    } catch (error) {
        console.error('Error in getEvaluationAnalytics:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get detailed evaluation data with filters
export const getDetailedEvaluations = async (req, res, next) => {
    try {
        const { 
            trigger, 
            satisfactionLevel, 
            dateFrom, 
            dateTo,
            page = 1,
            limit = 20
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        const where = {};
        
        if (trigger) {
            where.trigger = trigger;
        }
        
        if (satisfactionLevel) {
            where.OR = [
                { researchTrainingSatisfaction: satisfactionLevel },
                { supervisionSatisfaction: satisfactionLevel },
                { proposalDefenseSatisfaction: satisfactionLevel },
                { dissertationExaminationSatisfaction: satisfactionLevel }
            ];
        }
        
        if (dateFrom || dateTo) {
            where.submittedAt = {};
            if (dateFrom) {
                where.submittedAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                where.submittedAt.lte = new Date(dateTo);
            }
        }

        const [evaluations, totalCount] = await Promise.all([
            prisma.studentEvaluation.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: {
                    submittedAt: 'desc'
                },
                include: {
                    student: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                            registrationNumber: true,
                            programLevel: true
                        }
                    }
                }
            }),
            prisma.studentEvaluation.count({ where })
        ]);

        res.status(200).json({
            message: 'Detailed evaluations retrieved successfully',
            data: {
                evaluations: evaluations.map(evaluation => ({
                    id: evaluation.id,
                    student: {
                        ...evaluation.student,
                        name: `${evaluation.student.firstName} ${evaluation.student.lastName}`,
                        studentNumber: evaluation.student.registrationNumber,
                        program: evaluation.student.programLevel
                    },
                    trigger: evaluation.trigger,
                    submittedAt: evaluation.submittedAt,
                    ratings: {
                        researchTraining: evaluation.researchTrainingSatisfaction,
                        supervision: evaluation.supervisionSatisfaction,
                        proposalDefense: evaluation.proposalDefenseSatisfaction,
                        dissertationExamination: evaluation.dissertationExaminationSatisfaction
                    },
                    comments: {
                        researchTraining: evaluation.researchTrainingComments,
                        supervision: evaluation.supervisionComments,
                        proposalDefense: evaluation.proposalDefenseComments,
                        dissertationExamination: evaluation.dissertationExaminationComments,
                        overall: evaluation.overallComments,
                        suggestions: evaluation.suggestions
                    },
                    hasComments: !!(evaluation.overallComments || evaluation.suggestions)
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalCount,
                    hasNext: skip + parseInt(limit) < totalCount,
                    hasPrev: parseInt(page) > 1
                }
            }
        });

    } catch (error) {
        console.error('Error in getDetailedEvaluations:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/*** VIVA CONTROLLERS */
// Controller for recording viva verdict
export const recordVivaVerdict = async (req, res, next) => {
    try {
        const { vivaId } = req.params;
        const { verdict, comments, externalMark, internalMark } = req.body;

        // Validate inputs
        if (!vivaId || !verdict) {
            const error = new Error('Viva ID and verdict are required');
            error.statusCode = 400;
            throw error;
        }

        // Validate marks if provided
        if (externalMark !== undefined && (externalMark < 0 || externalMark > 100)) {
            const error = new Error('External mark must be between 0 and 100');
            error.statusCode = 400;
            throw error;
        }

        if (internalMark !== undefined && (internalMark < 0 || internalMark > 100)) {
            const error = new Error('Internal mark must be between 0 and 100');
            error.statusCode = 400;
            throw error;
        }

        // Calculate final marks (20% of each)
        const finalExternalMark = externalMark !== undefined ? (externalMark * 0.2) : null;
        const finalInternalMark = internalMark !== undefined ? (internalMark * 0.2) : null;

        // Check if viva exists
        const existingViva = await prisma.viva.findUnique({
            where: { id: vivaId },
            include: { 
                book: {
                    include: {
                        student: true
                    }
                }
            }
        });

        if (!existingViva) {
            const error = new Error('Viva not found');
            error.statusCode = 404;
            throw error;
        }

        // Determine viva status based on verdict and marks
        let vivaStatus;
        switch (verdict) {
            case 'PASS':
            case 'PASS_WITH_MINOR_CORRECTIONS':
            case 'PASS_WITH_MAJOR_CORRECTIONS':
                // Check if marks are provided and valid
                if (externalMark !== undefined && internalMark !== undefined) {
                    // Both marks must be at least 50 to pass
                    if (externalMark >= 50 && internalMark >= 50) {
                vivaStatus = 'COMPLETED';
                    } else {
                        vivaStatus = 'FAILED';
                    }
                } else {
                    vivaStatus = 'COMPLETED';
                }
                break;
            case 'FAIL':
                vivaStatus = 'FAILED';
                break;
            case 'RESCHEDULE':
                vivaStatus = 'RESCHEDULED';
                break;
            default:
                vivaStatus = 'COMPLETED';
        }

        // Update viva with verdict and marks
        const updatedViva = await prisma.viva.update({
            where: { id: vivaId },
            data: {
                verdict,
                comments,
                status: vivaStatus,
                externalMark,
                internalMark,
                finalExternalMark,
                finalInternalMark,
                completedAt: new Date()
            },
            include: {
                book: {
                    include: {
                        student: true
                    }
                },
                panelists: true
            }
        });

        // Update student and book status if passed
        if (verdict === 'PASS' || verdict === 'PASS_WITH_MINOR_CORRECTIONS' || verdict === 'PASS_WITH_MAJOR_CORRECTIONS' || vivaStatus === 'COMPLETED') {
            // Find status definition for minutes pending
            const minutesPendingStatus = await prisma.statusDefinition.findFirst({
                where: { name: 'minutes pending' }
            });

            if (minutesPendingStatus) {
                // First, update all current statuses to not current
                await prisma.studentStatus.updateMany({
                    where: {
                        studentId: existingViva.book.student.id,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date()
                    }
                });
                
                // Update student status
                await prisma.studentStatus.create({
                    data: {
                        student: {connect: {id: existingViva.book.student.id}},
                        definition: {connect: {id: minutesPendingStatus.id}},
                        startDate: new Date(),
                        isCurrent: true
                    }
                });

                // First, update all current book statuses to not current
                await prisma.bookStatus.updateMany({
                    where: {
                        bookId: existingViva.bookId,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date()
                    }
                });
                
                // Create new book status
                await prisma.bookStatus.create({
                    data: {
                        book: {connect: {id: existingViva.bookId}},
                        definition: {connect: {id: minutesPendingStatus.id}},
                        startDate: new Date(),
                        isCurrent: true
                    }
                });
            }
        } else if (vivaStatus === "FAILED") {
            const failedVivaStatus = await prisma.statusDefinition.findFirst({
                where: { name: 'failed viva' }
            });

            await prisma.studentStatus.updateMany({
                where: {
                    studentId: existingViva.book.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

             // Update student status
             await prisma.studentStatus.create({
                data: {
                    student: {connect: {id: existingViva.book.student.id}},
                    definition: {connect: {id: failedVivaStatus.id}},
                    startDate: new Date(),
                    isCurrent: true
                }
            });

              // First, update all current book statuses to not current
              await prisma.bookStatus.updateMany({
                where: {
                    bookId: existingViva.bookId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new book status
            await prisma.bookStatus.create({
                data: {
                    book: {connect: {id: existingViva.bookId}},
                    definition: {connect: {id: failedVivaStatus.id}},
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Recorded viva verdict: ${verdict} with marks (External: ${externalMark}, Internal: ${internalMark}) for ${existingViva.book?.title || `Book ID: ${existingViva.bookId}`}`,
                entityId: existingViva.bookId,
                entityType: "Student Book"
            }
        });

        res.status(200).json({
            message: 'Viva verdict and marks recorded successfully',
            viva: updatedViva
        });

    } catch (error) {
        console.error('Error in recordVivaVerdict:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for scheduling viva
export const scheduleViva = async (req, res, next) => {
    try {
        const { bookId } = req.params;
        const {
            scheduledDate,
            location,
            panelistIds,
            reviewerIds,// This will now be external examiner IDs
            chairpersonId,  // This will now be internal examiner ID
            minutesSecretaryId,
        } = req.body;

        // Validate inputs
        if (
            !bookId ||
            !scheduledDate ||
            !Array.isArray(panelistIds) ||
            panelistIds.length === 0
        ) {
            throw new Error(
                "Book ID, scheduled date, and at least one panelist are required",
                { statusCode: 400 }
            );
        }

        // Check if book exists
        const existingBook = await prisma.book.findUnique({
            where: { id: bookId },
            include: {
                student: {
                    include: {
                        supervisors: true,
                    },
                },
                statuses: {
                    include: {
                        definition: true,
                    },
                },
                examinerAssignments: {
                    where: {
                        isCurrent: true,
                    },
                    include: {
                        examiner: true,
                    },
                },
            },
        });

        if (!existingBook) {
            const error = new Error("Dissertation not found");
            error.statusCode = 404;
            throw error;
        }

         // Get current internal and external examiners from assignments
         const internalExaminers = existingBook.examinerAssignments
         .filter(assignment => assignment.examiner.type === "Internal")
         .map(assignment => assignment.examiner);
     
     const externalExaminers = existingBook.examinerAssignments
         .filter(assignment => assignment.examiner.type === "External")
         .map(assignment => assignment.examiner);

     // Validate chairperson (must be an internal examiner assigned to this book)
     if (chairpersonId) {
         const isValidInternalExaminer = internalExaminers.some(
             examiner => examiner.id === chairpersonId
         );
         if (!isValidInternalExaminer) {
             const error = new Error("Chairperson must be an internal examiner assigned to this book");
             error.statusCode = 400;
             throw error;
         }
     }

            // Validate reviewers (must be external examiners assigned to this book)
            if (reviewerIds && reviewerIds.length > 0) {
                const validExternalExaminerIds = externalExaminers.map(examiner => examiner.id);
                const invalidReviewers = reviewerIds.filter(
                    id => !validExternalExaminerIds.includes(id)
                );
                if (invalidReviewers.length > 0) {
                    const error = new Error("All reviewers must be external examiners assigned to this book");
                    error.statusCode = 400;
                    throw error;
                }
            }

        // Check if panelists exist
        const panelists = await prisma.panelist.findMany({
            where: {
                id: {
                    in: panelistIds,
                },
            },
        });

        if (panelists.length !== panelistIds.length) {
            const error = new Error("One or more panelists not found");
            error.statusCode = 404;
            throw error;
        }

        // Get the current attempt number
        const currentVivas = await prisma.viva.findMany({
            where: { 
                bookId: bookId,
            },
            orderBy: {
                attempt: "desc",
            },
            take: 1,
        });

        const attemptNumber = currentVivas.length > 0 ? currentVivas[0].attempt + 1 : 1;

        // If there's a current viva, mark it as not current
        if (currentVivas.length > 0 && currentVivas[0].isCurrent) {
            await prisma.viva.update({
                where: { id: currentVivas[0].id },
                data: { isCurrent: false },
            });
        }

        // Create new viva
        const viva = await prisma.viva.create({
            data: {
                book: { connect: { id: bookId } },
                scheduledDate: new Date(scheduledDate),
                location,
                status: "SCHEDULED",
                attempt: attemptNumber,
                panelists: { connect: panelistIds.map((id) => ({ id })) },
                isCurrent: true,
                  // Use internal examiner as chairperson
                  internalExaminerChairperson: chairpersonId
                  ? { connect: { id: chairpersonId } }
                  : undefined,
              // Use external examiners as reviewers
              externalExaminers: reviewerIds && reviewerIds.length > 0
                  ? { connect: reviewerIds.map((id) => ({ id })) }
                  : undefined,
              minutesSecretary: minutesSecretaryId
                  ? { connect: { id: minutesSecretaryId } }
                  : undefined,
                chairperson: chairpersonId
                    ? { connect: { id: chairpersonId } }
                    : undefined,
               
                reviewers: reviewerIds ? { connect: reviewerIds.map((id) => ({ id })) } : undefined,
            },
            include: {
                panelists: true,
                internalExaminerChairperson: true,
                externalExaminers: true,
                reviewers: true,
                chairperson: true,
                minutesSecretary: true,
                book: {
                    include: {
                        student: true,
                        examinerAssignments: {
                            where: {
                                isCurrent: true,
                            },
                            include: {
                                examiner: true,
                            },
                        },
                    },
                },
            },
        });

        // Find the status definition for "waiting for viva"
        const scheduledForVivaStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "scheduled for viva",
            },
        });

        if (scheduledForVivaStatus) {
            // Set all current book statuses to not current
            await prisma.bookStatus.updateMany({
                where: { 
                    bookId: bookId,
                    isCurrent: true,
                },
                data: {
                    isCurrent: false,
                    endDate: new Date(),
                },
            });

            // Create new book status
            await prisma.bookStatus.create({
                data: {
                    book: { connect: { id: bookId } },
                    definition: { connect: { id: scheduledForVivaStatus.id } },
                    startDate: new Date(),
                    isActive: true,
                    isCurrent: true,
                },
            });

            // Update student status as well
            if (existingBook.student) {
                // Set all current student statuses to not current
                await prisma.studentStatus.updateMany({
                    where: { 
                        studentId: existingBook.student.id,
                        isCurrent: true,
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date(),
                    },
                });

                // Create new student status with the same definition
                await prisma.studentStatus.create({
                    data: {
                        student: { connect: { id: existingBook.student.id } },
                        definition: { connect: { id: scheduledForVivaStatus.id } },
                        startDate: new Date(),
                        isActive: true,
                        isCurrent: true,
                        updatedBy: { connect: { id: req.user.id } },
                    },
                });
            }
        }

          // Log activity with examiner information
          const chairpersonName = viva.internalExaminerChairperson?.name || "No chairperson";
          const reviewerNames = viva.externalExaminers?.map(examiner => examiner.name).join(", ") || "No reviewers";

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Scheduled viva for ${
                    existingBook.student?.firstName || "Unknown Student"
                } ${existingBook.student?.lastName || ""} with chairperson: ${chairpersonName}, reviewers: ${reviewerNames}`,
                entityId: viva.id,
                entityType: "Viva",
            },
        });

        // Schedule viva invitation emails
        const vivaDate = new Date(viva.scheduledDate);
        const formattedDate = vivaDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
        });

        // Send invitation emails to all participants
        const participants = [
            // Add student first
            {
                category: "STUDENT",
                id: existingBook.student.id,
                email: existingBook.student.email,
                name: `${existingBook.student.firstName} ${existingBook.student.lastName}`,
            },
            // Add all supervisors
            ...existingBook.student.supervisors.map((supervisor) => ({
                category: "SUPERVISOR",
                id: supervisor.id,
                email: supervisor.email,
                name: supervisor.name,
            })),
             // Add internal examiner chairperson if exists
            ...(viva.internalExaminerChairperson
                ? [
                    {
                        category: "EXAMINER",
                        id: viva.internalExaminerChairperson.id,
                        email: viva.internalExaminerChairperson.primaryEmail,
                        name: viva.internalExaminerChairperson.name,
                    },
                ]
                : []),
                // Add external examiner reviewers
            ...(viva.externalExaminers ? viva.externalExaminers.map((examiner) => ({
                category: "EXAMINER",
                id: examiner.id,
                email: examiner.primaryEmail,
                name: examiner.name,
            })) : []),
            // Add chairperson if exists
            ...(viva.chairperson
                ? [
                    {
                        category: "CHAIRPERSON",
                        id: viva.chairperson.id,
                        email: viva.chairperson.email,
                        name: viva.chairperson.name,
                    },
                ]
                : []),
            // Add minutes secretary if exists
            ...(viva.minutesSecretary
                ? [
                    {
                        category: "MINUTES_SECRETARY",
                        id: viva.minutesSecretary.id,
                        email: viva.minutesSecretary.email,
                        name: viva.minutesSecretary.name,
                    },
                ]
                : []),
            // Add panelists
            ...viva.panelists.map((panelist) => ({
                category: "PANELIST",
                id: panelist.id,
                email: panelist.email,
                name: panelist.name,
            })),
            // Add reviewers if they exist
            ...(viva.reviewers ? viva.reviewers.map((reviewer) => ({
                category: "REVIEWER",
                id: reviewer.id,
                email: reviewer.email,
                name: reviewer.name,
            })) : []),
        ];

        // Schedule immediate invitations
        for (const participant of participants) {
            // Customize message based on participant type
            let message = `You are invited to attend the viva of ${existingBook.student.firstName} ${existingBook.student.lastName}.`;
            let additionalContent = `
                <p><strong>Details:</strong></p>
                <ul>
                    <li>Date: ${formattedDate}</li>
                    <li>Venue: ${viva.location}</li>
                    <li>Title: ${existingBook.title}</li>
                </ul>
            `;

            if (participant.category === "STUDENT") {
                message = `Your viva has been scheduled.`;
                additionalContent += `
                    <p><strong>Important Information:</strong></p>
                    <ul>
                        <li>Please ensure you have prepared your presentation</li>
                        <li>Bring any necessary materials or equipment</li>
                        <li>Arrive at least 15 minutes before the scheduled time</li>
                    </ul>
                `;
            }

            additionalContent += `
                <p>Please confirm your attendance.</p>
                <p>Best regards,</p>
                <p>UMI System</p>
            `;

            await notificationService.scheduleNotification({
                type: "EMAIL",
                statusType: "PENDING",
                title: `Viva Invitation - ${existingBook.student.firstName} ${existingBook.student.lastName}`,
                message,
                recipientCategory: participant.category,
                recipientId: participant.id,
                recipientEmail: participant.email,
                recipientName: participant.name,
                scheduledFor: new Date(new Date().getTime() + 60000), // Send after 1 minute
                metadata: {
                    additionalContent,
                },
            });
        }

        // Schedule reminder notifications (24 hours before viva)
        const reminderDate = new Date(vivaDate);
        reminderDate.setHours(reminderDate.getHours() - 24);

        for (const participant of participants) {
            let message = `Reminder: Viva for ${existingBook.student.firstName} ${existingBook.student.lastName} is scheduled for tomorrow.`;
            let additionalContent = `
                <p><strong>Viva Details:</strong></p>
                <ul>
                    <li>Date: ${formattedDate}</li>
                    <li>Venue: ${viva.location}</li>
                    <li>Title: ${existingBook.title}</li>
                </ul>
            `;

            if (participant.category === "STUDENT") {
                message = `Reminder: Your viva is scheduled for tomorrow.`;
                additionalContent += `
                    <p><strong>Final Preparation Checklist:</strong></p>
                    <ul>
                        <li>Review your presentation</li>
                        <li>Prepare any necessary materials</li>
                        <li>Get a good night's rest</li>
                        <li>Plan your journey to the venue</li>
                    </ul>
                `;
            }

            additionalContent += `
                <p>Please ensure you have prepared for the viva.</p>
                <p>Best regards,</p>
                <p>UMI System</p>
            `;

            await notificationService.scheduleNotification({
                type: "REMINDER",
                statusType: "PENDING",
                title: "Viva Reminder",
                message,
                recipientCategory: participant.category,
                recipientId: participant.id,
                recipientEmail: participant.email,
                recipientName: participant.name,
                scheduledFor: reminderDate,
                metadata: {
                    additionalContent,
                },
            });
        }

        // Schedule final reminder (1 hour before viva)
        const finalReminderDate = new Date(vivaDate);
        finalReminderDate.setHours(finalReminderDate.getHours() - 1);

        for (const participant of participants) {
            let message = `Final reminder: Viva for ${existingBook.student.firstName} ${existingBook.student.lastName} is scheduled in 1 hour.`;
            let additionalContent = `
                <p><strong>Viva Details:</strong></p>
                <ul>
                    <li>Date: ${formattedDate}</li>
                    <li>Venue: ${viva.location}</li>
                    <li>Title: ${existingBook.title}</li>
                </ul>
            `;

            if (participant.category === "STUDENT") {
                message = `Final reminder: Your viva is scheduled in 1 hour.`;
                additionalContent += `
                    <p><strong>Last Minute Checklist:</strong></p>
                    <ul>
                        <li>Ensure you have all necessary materials</li>
                        <li>Check your presentation one final time</li>
                        <li>Head to the venue now</li>
                        <li>Take deep breaths and stay calm</li>
                    </ul>
                `;
            }

            additionalContent += `
                <p>Please proceed to the venue.</p>
                <p>Best regards,</p>
                <p>UMI System</p>
            `;

            await notificationService.scheduleNotification({
                type: "REMINDER",
                statusType: "PENDING",
                title: "Final Reminder: Viva",
                message,
                recipientCategory: participant.category,
                recipientId: participant.id,
                recipientEmail: participant.email,
                recipientName: participant.name,
                scheduledFor: finalReminderDate,
                metadata: {
                    additionalContent,
                },
            });
        }

        res.status(201).json({
            message: "Viva scheduled successfully",
            viva: viva,
        });

    } catch (error) {
        console.error("Error in scheduleViva:", error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for adding a new panelist
export const addNewPanelist = async (req, res, next) => {
    try {
       
        const { name, email, institution } = req.body;

        // Validate inputs
        if (!name || !email) {
            const error = new Error('Name and email are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if panelist already exists
        const existingPanelist = await prisma.panelist.findUnique({
            where: { email }
        });

        if (existingPanelist) {
            const error = new Error('Panelist with this email already exists');
            error.statusCode = 400;
            throw error;
        }

        // Create new panelist
        const newPanelist = await prisma.panelist.create({
            data: {
                name,
                email,
                institution
            }
        });

        res.status(201).json({
            message: 'Panelist added successfully',
            panelist: newPanelist
        });

    } catch (error) {
        console.error('Error in addNewPanelist:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting all panelists
export const getAllPanelists = async (req, res, next) => {
    try {
        const panelists = await prisma.panelist.findMany();
        res.status(200).json({
            message: 'Panelists fetched successfully',  
            panelists
        });
    } catch (error) {
        console.error('Error in getAllPanelists:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting all vivas for a specific book
export const getBookVivas = async (req, res, next) => {
    try {
        const { bookId } = req.params;

        if (!bookId) {
            const error = new Error('Book ID is required');
            error.statusCode = 400;
            throw error;
        }

        // Fetch all vivas for the specified book with related panelists
        const vivas = await prisma.viva.findMany({
            where: {
                bookId
            },
            include: {
                panelists: true
            },
            orderBy: {
                scheduledDate: 'desc'
            }
        });

        res.status(200).json({
            message: 'Book vivas fetched successfully',
            vivas
        });
    } catch (error) {
        console.error('Error in getBookVivas:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Controller for updating minutes sent date for a book
export const updateMinutesSentDate = async (req, res, next) => {
    try {
        const { bookId } = req.params;
        const { minutesSentDate } = req.body;

        if (!bookId) {
            const error = new Error('Book ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!minutesSentDate) {
            const error = new Error('Minutes sent date is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if book exists
        const existingBook = await prisma.book.findUnique({
            where: { id: bookId },
            include: {
                student: true
            }
        });

        if (!existingBook) {
            const error = new Error('Book not found');
            error.statusCode = 404;
            throw error;
        }

        // Update book with minutes sent date
        const updatedBook = await prisma.book.update({
            where: { id: bookId },
            data: {
                minutesSentDate: new Date(minutesSentDate)
            },
            include: {
                student: true
            }
        });

        // Find status definition for minutes sent
        const minutesSentStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'minutes sent' }
        });

        if (minutesSentStatus) {
            // First, update all current statuses to not current for student
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: existingBook.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Update student status
            await prisma.studentStatus.create({
                data: {
                    student: {connect: {id: existingBook.student.id}},
                    definition: {connect: {id: minutesSentStatus.id}},
                    startDate: new Date(),
                    isCurrent: true
                }
            });

            // First, update all current book statuses to not current
            await prisma.bookStatus.updateMany({
                where: {
                    bookId: bookId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new book status
            await prisma.bookStatus.create({
                data: {
                    book: {connect: {id: bookId}},
                    definition: {connect: {id: minutesSentStatus.id}},
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated minutes sent date to ${new Date(minutesSentDate).toISOString().split('T')[0]} for book: ${existingBook.title || `Book for ${existingBook.student?.firstName || 'Unknown Student'}`}`,
                entityId: updatedBook.id,
                entityType: "Student Book"
            }
        });

        res.status(200).json({
            message: 'Minutes sent date updated successfully',
            book: updatedBook
        });

    } catch (error) {
        console.error('Error in updateMinutesSentDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating compliance report date for a book
export const updateComplianceReportDate = async (req, res, next) => {
    try {
        const { bookId } = req.params;
        const { complianceReportDate, actualTopic } = req.body;

        if (!bookId) {
            const error = new Error('Book ID is required');
            error.statusCode = 400;
            throw error;
        }

        if (!complianceReportDate) {
            const error = new Error('Compliance report date is required');
            error.statusCode = 400;
            throw error;
        }

        if (!actualTopic) {
            const error = new Error('Actual topic is required');
            error.statusCode = 400;
            throw error;
        }

        // Check if book exists
        const existingBook = await prisma.book.findUnique({
            where: { id: bookId },
            include: {
                student: true
            }
        });

        if (!existingBook) {
            const error = new Error('Book not found');
            error.statusCode = 404;
            throw error;
        }

        // Update book with compliance report date and actual topic
        const updatedBook = await prisma.book.update({
            where: { id: bookId },
            data: {
                complianceReportDate: new Date(complianceReportDate),
                actualTopic: actualTopic
            },
            include: {
                student: true
            }
        });

        // Find status definition for final dissertation & compliance report received
        const finalBookStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'final dissertation & compliance report received' }
        });

        if (finalBookStatus) {
            // First, update all current statuses to not current for student
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: existingBook.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Update student status
            await prisma.studentStatus.create({
                data: {
                    student: {connect: {id: existingBook.student.id}},
                    definition: {connect: {id: finalBookStatus.id}},
                    startDate: new Date(),
                    isCurrent: true
                }
            });

            // First, update all current book statuses to not current
            await prisma.bookStatus.updateMany({
                where: {
                    bookId: bookId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new book status
            await prisma.bookStatus.create({
                data: {
                    book: {connect: {id: bookId}},
                    definition: {connect: {id: finalBookStatus.id}},
                    startDate: new Date(),
                    endDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated compliance report date to ${new Date(complianceReportDate).toISOString().split('T')[0]} and actual topic for book: ${existingBook.title || `Book for ${existingBook.student?.firstName || 'Unknown Student'}`}`,
                entityId: updatedBook.id,
                entityType: "Student Book"
            }
        });

        res.status(200).json({
            message: 'Compliance report date and actual topic updated successfully',
            book: updatedBook
        });

    } catch (error) {
        console.error('Error in updateComplianceReportDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating results approval date
export const updateResultsApprovalDate = async (req, res, next) => {
    try {
        const {studentId} = req.params;
        const { resultsApprovedDate } = req.body;

        if (!studentId || !resultsApprovedDate) {
            const error = new Error('Student ID and results approval date are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    where: { isCurrent: true },
                    include: { definition: true }
                }
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Update the student with the results approval date
        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: {
                resultsApprovedDate: new Date(resultsApprovedDate)
            }
        });

        // Check if we need to update student status
        const currentStatus = student.statuses[0];
        
        // Find the "Results Approved" status definition
        const resultsApprovedStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "results approved",
            }
        });

        if (resultsApprovedStatus && (!currentStatus || currentStatus.definition.name !== "results approved")) {
            // First, update all current statuses to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: studentId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new student status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: studentId } },
                    definition: { connect: { id: resultsApprovedStatus.id } },
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated results approval date to ${new Date(resultsApprovedDate).toISOString().split('T')[0]} for student: ${student.firstName} ${student.lastName}`,
                entityId: studentId,
                entityType: "Student"
            }
        });

        res.status(200).json({
            message: 'Results approval date updated successfully',
            student: updatedStudent
        });

    } catch (error) {
        console.error('Error in updateResultsApprovalDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating results sent date
export const updateResultsSentDate = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { resultsSentDate } = req.body;

        if (!studentId || !resultsSentDate) {
            const error = new Error('Student ID and results sent date are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Update the student with the results sent date
        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: {
                resultsSentDate: new Date(resultsSentDate)
            }
        });

        // Find the "results sent to schools" status definition
        const resultsSentStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "results sent to schools"
            }
        });

        // Get current status
        const currentStatus = await prisma.studentStatus.findFirst({
            where: {
                studentId: studentId,
                isCurrent: true
            },
            include: {
                definition: true
            }
        });

        // Update student status if the status definition exists and it's not already the current status
        if (resultsSentStatus && (!currentStatus || currentStatus.definition.name !== "results sent")) {
            // First, update all current statuses to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: studentId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new student status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: studentId } },
                    definition: { connect: { id: resultsSentStatus.id } },
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated results sent date to ${new Date(resultsSentDate).toISOString().split('T')[0]} for student: ${student.firstName} ${student.lastName}`,
                entityId: studentId,
                entityType: "Student"
            }
        });

        res.status(200).json({
            message: 'Results sent date updated successfully',
            student: updatedStudent
        });

    } catch (error) {
        console.error('Error in updateResultsSentDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for updating senate approval date
export const updateSenateApprovalDate = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { senateApprovalDate } = req.body;

        if (!studentId || !senateApprovalDate) {
            const error = new Error('Student ID and senate approval date are required');
            error.statusCode = 400;
            throw error;
        }

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    where: { isCurrent: true },
                    include: { definition: true }
                }
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Update the student with the senate approval date
        const updatedStudent = await prisma.student.update({
            where: { id: studentId },
            data: {
                senateApprovalDate: new Date(senateApprovalDate)
            }
        });

        // Find the "results approved by senate" status definition
        const senateApprovedStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: "results approved by senate"
            }
        });

        const currentStatus = student.statuses[0];

        // Update student status if the status definition exists and it's not already the current status
        if (senateApprovedStatus && (!currentStatus || currentStatus.definition.name !== "results approved by senate")) {
            // First, update all current statuses to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: studentId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });
            
            // Create new student status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: studentId } },
                    definition: { connect: { id: senateApprovedStatus.id } },
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        // Log activity
        await prisma.userActivity.create({
            data: {
                userId: req.user.id,
                action: `Updated senate approval date to ${new Date(senateApprovalDate).toISOString().split('T')[0]} for student: ${student.firstName} ${student.lastName}`,
                entityId: studentId,
                entityType: "Student"
            }
        });

        res.status(200).json({
            message: 'Senate approval date updated successfully',
            student: updatedStudent
        });

    } catch (error) {
        console.error('Error in updateSenateApprovalDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


/*** DASHBOARD CONTROLLERS */

/**
 * Get dashboard statistics
 * @route GET /api/v1/management/dashboard/stats
 * @access Private (Admin, Management)
 */
export const getDashboardStats = async (req, res, next) => {
    try {
        // Get total students count
        const totalStudents = await prisma.student.count();
        
        // Get recently enrolled students (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentlyEnrolled = await prisma.student.count({
            where: {
                createdAt: {
                    gte: thirtyDaysAgo
                }
            }
        });
        
        // Get students by status
        const statusCounts = await prisma.studentStatus.groupBy({
            by: ['definitionId'],
            where: {
                isCurrent: true
            },
            _count: {
                studentId: true
            }
        });
        
        // Get status definitions to map counts
        const statusDefinitions = await prisma.statusDefinition.findMany();
        
        // Map status counts to their names
        const statusMap = {};
        statusCounts.forEach(status => {
            const definition = statusDefinitions.find(def => def.id === status.definitionId);
            if (definition) {
                statusMap[definition.name.toLowerCase().replace(/\s+/g, '')] = status._count.studentId;
            }
        });
        
        // Extract specific status counts
        const workshop = statusMap.workshop || 0;
        const normalProgress = statusMap.normalprogress || 0;
        const underExamination = statusMap.underexamination || 0;
        
        // Get total ongoing students (excluding graduated and deregistered)
        const ongoingStudents = await prisma.student.count({
            where: {
                statuses: {
                    some: {
                        isCurrent: true,
                        definition: {
                            name: {
                                notIn: ['graduated', 'deregistered']
                            }
                        }
                    }
                }
            }
        });
        
        // Log activity
        // await prisma.userActivity.create({
        //     data: {
        //         userId: req.user.id,
        //         action: 'Retrieved dashboard statistics',
        //         entityType: "System"
        //     }
        // });
        
        res.status(200).json({
            totalStudents: totalStudents.toLocaleString(),
            recentlyEnrolled: recentlyEnrolled.toString(),
            workshop: workshop.toString(),
            normalProgress: normalProgress.toString(),
            underExamination: underExamination.toString(),
            ongoingStudents: ongoingStudents.toString()
        });
        
    } catch (error) {
        console.error('Error in getDashboardStats:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for getting student status statistics for dashboard charts
export const getStatusStatistics = async (req, res, next) => {
  try {
    const { category = 'main' } = req.query;
    console.log("category", category);
    let whereCondition = {};
    let stats = [];
    
    // Define different category filters
    if (category === 'main') {
      whereCondition = {
        isCurrent: true,
        definition: {
          name: {
            in: [
              'normal progress',
              'fieldwork',
              'under examination',
              'scheduled for viva',
              'results approved',
              'results sent to schools',
              'results approved by senate',
             
            ]
          }
        }
      };
      
      stats = await prisma.studentStatus.groupBy({
        by: ['definitionId'],
        _count: true,
        where: whereCondition
      });
    } else if (category === 'proposal') {
      whereCondition = {
        isCurrent: true,
        definition: {
          name: {
            in: [
              'proposal received',
              'proposal in review',
              'waiting for proposal defense',
              'compliance report submitted',
              'letter to field issued'
            ]
          }
        }
      };
      
      stats = await prisma.proposalStatus.groupBy({
        by: ['definitionId'],
        _count: true,
        where: whereCondition
      });
    } else if (category === 'book') {
      whereCondition = {

        definition: {
          name: {
            in: [
              'book planning',
              'book writing',
              'dissertation submitted',
              'book under review',
              'book published'
            ]
          }
        }
      };
      
      stats = await prisma.bookStatus.groupBy({
        by: ['definitionId'],
        _count: true,
        where: whereCondition
      });
    }

    // Then get the definitions to map names
    const definitions = await prisma.statusDefinition.findMany({
      where: {
        id: {
          in: stats.map(stat => stat.definitionId)
        }
      },
      select: {
        id: true,
        name: true,
        color: true
      }
    });
  
    // Create a map of definition IDs to names and colors
    const definitionMap = definitions.reduce((acc, def) => {
      acc[def.id] = {
        name: def.name,
        color: def.color || getDefaultColor(def.name)
      };
      return acc;
    }, {});
  
    // Transform the data into an array with status, students, and fill
    const statusArray = stats.map(stat => {
      const definition = definitionMap[stat.definitionId];
      return {
        status: definition.name,
        students: stat._count,
        fill: definition.color
      };
    });
    
    res.json(statusArray);
  } catch (error) {
    console.error('Error in getStatusStatistics:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Helper function to get default colors if not provided in the database
const getDefaultColor = (statusName) => {
  const colorMap = {
    'normal progress': '#22C55E',
    'fieldwork': '#3B82F6',
    'under examination': '#EAB308',
    'scheduled for viva': '#EC4899',
    'results approved': '#14B8A6'
  };
  
  return colorMap[statusName.toLowerCase()] || '#6B7280'; // Default gray color
};

export const getProgressTrends = async (req, res, next) => {
    try {
      const { timeRange } = req.query;
      const daysToLookBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToLookBack);
  
      // Get all relevant status changes in the time period
      const statusChanges = await prisma.studentStatus.findMany({
        where: {
          createdAt: {
            gte: startDate
          },
          definition: {
            name: {
              in: ['dissertation submitted', 'under examination', 'scheduled for viva']
            }
          }
        },
        include: {
          definition: {
            select: {
              name: true,
              color: true
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
  
      // Generate array of dates
      const dates = [];
      for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
  
      // Define default colors for each status
      const defaultColors = {
        'dissertation submitted': '#23388F',  // dark blue
        'under examination': '#EAB308',  // yellow
        'scheduled for viva': '#EC4899'  // pink
      };
  
      // Get the colors from status definitions
      const statusDefinitions = await prisma.statusDefinition.findMany({
        where: {
          name: {
            in: ['dissertation submitted', 'under examination', 'scheduled for viva']
          }
        },
        select: {
          name: true,
          color: true
        }
      });
      
      // Create a map of status names to their colors
      const statusColors = {};
      statusDefinitions.forEach(def => {
        statusColors[def.name] = def.color || defaultColors[def.name];
      });
     
      
      // Use these colors consistently across all data points
      const submissionsColor = statusColors['dissertation submitted'] || defaultColors['dissertation submitted'];
      const examinationsColor = statusColors['under examination'] || defaultColors['under examination'];
      const vivasColor = statusColors['scheduled for viva'] || defaultColors['scheduled for viva'];
      // Transform the data into daily counts
      const stats = dates.map(date => {
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));
        
        const dayStats = statusChanges.filter(status => 
          status.createdAt >= dayStart && status.createdAt <= dayEnd
        );
  
        const submissionStats = dayStats.filter(s => s.definition.name === 'dissertation submitted');
        const examinationStats = dayStats.filter(s => s.definition.name === 'under examination');
        const vivaStats = dayStats.filter(s => s.definition.name === 'scheduled for viva');
  
        return {
          date: dayStart.toISOString().split('T')[0],
          submissions: submissionStats.length,
          submissionsColor: submissionsColor,
          examinations: examinationStats.length,
          examinationsColor: examinationsColor,
          vivas: vivaStats.length,
          vivasColor: vivasColor
        };
      });
  
      res.json(stats);
  
    } catch (error) {
      console.error('Error fetching progress trends:', error);
      next(error);
    }
  };

/*** NOTIFICATION CONTROLLERS */

// Controller to get notifications
export const getNotifications = async (req, res, next) => {
    try {
      // Get all notifications with student status information
      const notifications = await prisma.notification.findMany({
        include: {
          studentStatus: {
            include: {
              definition: true,
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                
                }
              }
            }
          }
        },
        orderBy: {
          scheduledFor: 'desc'
        }
      });
      
      console.log("notifications", notifications);
      
      res.status(200).json({
        notifications
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    }
  };
  
  // Controller to get status report for all students
  export const getAllStudentsStatusReport = async (req, res, next) => {
    try {
      // Find all students with their current status
      const students = await prisma.student.findMany({
        include: {
          studentStatuses: {
            include: {
              definition: true,
              notifications: true
            },
            orderBy: {
              startDate: 'desc'
            }
          }
        }
      });
  
      const today = new Date();
      const statusReports = [];
  
      for (const student of students) {
        // Get current status
        const currentStatus = student.studentStatuses.find(status => status.isCurrent);
        
        if (!currentStatus) {
          continue; // Skip students without a current status
        }
  
        // Calculate expected end date based on definition duration
        const startDate = new Date(currentStatus.startDate);
        const expectedDuration = currentStatus.definition.expectedDurationDays;
        const expectedEndDate = new Date(startDate);
        expectedEndDate.setDate(expectedEndDate.getDate() + expectedDuration);
        
        // Calculate if status is delayed
        const isDelayed = today > expectedEndDate;
        
        // Calculate days in status
        const daysInStatus = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        
        // Calculate days remaining or days overdue
        let daysRemaining = 0;
        let daysOverdue = 0;
        
        if (isDelayed) {
          daysOverdue = Math.floor((today - expectedEndDate) / (1000 * 60 * 60 * 24));
        } else {
          daysRemaining = Math.floor((expectedEndDate - today) / (1000 * 60 * 60 * 24));
        }
  
        // Get notifications related to this status
        const statusNotifications = currentStatus.notifications || [];
  
        // Prepare the status report for this student
        statusReports.push({
          student: {
            id: student.id,
            name: `${student.firstName} ${student.lastName}`,
            email: student.email
          },
          currentStatus: {
            id: currentStatus.id,
            name: currentStatus.definition.name,
            description: currentStatus.definition.description,
            startDate: currentStatus.startDate,
            expectedDurationDays: expectedDuration,
            expectedEndDate: expectedEndDate,
            daysInStatus,
            isDelayed,
            daysRemaining: isDelayed ? 0 : daysRemaining,
            daysOverdue: isDelayed ? daysOverdue : 0
          },
          notifications: statusNotifications.map(notification => ({
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            scheduledFor: notification.scheduledFor,
            sentAt: notification.sentAt,
            statusType: notification.statusType
          }))
        });
      }
  
      res.status(200).json({
        statusReports
      });
    } catch (error) {
      console.error('Error generating all students status report:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    }
  };
  
  // Controller to get status report for a single student
  export const getStudentStatusReport = async (req, res, next) => {
    try {
      const { studentId } = req.params;
  
      // Find the student with their current status
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          studentStatuses: {
            include: {
              definition: true,
              notifications: true
            },
            orderBy: {
              startDate: 'desc'
            }
          }
        }
      });
  
      if (!student) {
        const error = new Error('Student not found');
        error.statusCode = 404;
        throw error;
      }
  
      // Get current status (should be the first one as we ordered by startDate desc)
      const currentStatus = student.studentStatuses.find(status => status.isCurrent);
      
      if (!currentStatus) {
        const error = new Error('No current status found for student');
        error.statusCode = 404;
        throw error;
      }
  
      // Calculate expected end date based on definition duration
      const startDate = new Date(currentStatus.startDate);
      const expectedDuration = currentStatus.definition.expectedDurationDays;
      const expectedEndDate = new Date(startDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + expectedDuration);
      
      // Calculate if status is delayed
      const today = new Date();
      const isDelayed = today > expectedEndDate;
      
      // Calculate days in status
      const daysInStatus = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      
      // Calculate days remaining or days overdue
      let daysRemaining = 0;
      let daysOverdue = 0;
      
      if (isDelayed) {
        daysOverdue = Math.floor((today - expectedEndDate) / (1000 * 60 * 60 * 24));
      } else {
        daysRemaining = Math.floor((expectedEndDate - today) / (1000 * 60 * 60 * 24));
      }
  
      // Get notifications related to this status
      const statusNotifications = await prisma.notification.findMany({
        where: {
          studentStatusId: currentStatus.id
        },
        orderBy: {
          scheduledFor: 'desc'
        }
      });
  
      // Prepare the status report
      const statusReport = {
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          email: student.email
        },
        currentStatus: {
          id: currentStatus.id,
          name: currentStatus.definition.name,
          description: currentStatus.definition.description,
          startDate: currentStatus.startDate,
          expectedDurationDays: expectedDuration,
          expectedEndDate: expectedEndDate,
          daysInStatus,
          isDelayed,
          daysRemaining: isDelayed ? 0 : daysRemaining,
          daysOverdue: isDelayed ? daysOverdue : 0
        },
        notifications: statusNotifications.map(notification => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          scheduledFor: notification.scheduledFor,
          sentAt: notification.sentAt,
          statusType: notification.statusType
        })),
        statusHistory: student.studentStatuses
          .filter(status => !status.isCurrent)
          .map(status => ({
            id: status.id,
            name: status.definition.name,
            startDate: status.startDate,
            endDate: status.endDate,
            expectedDurationDays: status.definition.expectedDurationDays,
            actualDurationDays: status.endDate 
              ? Math.floor((new Date(status.endDate) - new Date(status.startDate)) / (1000 * 60 * 60 * 24))
              : null
          }))
      };
  
      res.status(200).json({
        statusReport
      });
    } catch (error) {
      console.error('Error generating student status report:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      next(error);
    }
  };

// Controller for requesting a password reset
export const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;

        
        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email }
        });
        
        if (!user) {
            const error = new Error('No account found with that email address');
            error.statusCode = 404;
            throw error;
        }
        
        // Generate a reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // Token valid for 1 hour
        
        // Save the reset token to the faculty record
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry
            }
        });
        
        // Frontend URL for password reset
        const frontendUrl = process.env.FACULTY_CLIENT_URL || 'https://umircportal.netlify.app';
        // const frontendUrl = process.env.FACULTY_CLIENT_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
        
        // Email template
        const emailTemplate = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4a6da7; color: white; padding: 10px; text-align: center; }
                        .content { padding: 20px; border: 1px solid #ddd; }
                        .button { display: inline-block; background-color: #4a6da7; color: white; padding: 10px 20px; 
                                text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Password Reset Request</h2>
                        </div>
                        <div class="content">
                            <p>Hello ${user.name},</p>
                            <p>We received a request to reset your password for your UMI Faculty account.</p>
                            <p>Please click the button below to reset your password. This link will expire in 1 hour.</p>
                            <p><a href="${resetLink}" class="button">Reset Password</a></p>
                            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
                            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
                            <p>${resetLink}</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message, please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} UMI Research Management System</p>
                        </div>
                    </div>
                </body>
            </html>
        `;
        
        // Send email
        await emailService.sendEmail({
            to: user.email,
            subject: 'Password Reset Request',
            htmlContent: emailTemplate
        });
        
        res.status(200).json({
            message: 'Password reset link has been sent to your email'
        });
    } catch (error) {
        console.error('Password reset request error:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller for resetting password with token
export const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        
        // Find faculty with valid reset token
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date()
                }
            }
        });
        
        if (!user) {
            const error = new Error('Invalid or expired reset token');
            error.statusCode = 400;
            throw error;
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        // Update password and clear reset token
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });
        
        // Create nodemailer transporter
        const transporter = nodemailer.createTransport({
            // host: process.env.EMAIL_HOST,
            host: 'smtp.gmail.com',
            // port: process.env.EMAIL_PORT,
            port: 587,
            // secure: process.env.EMAIL_SECURE === 'true',
            secure: false,
            auth: {
                user: process.env.NODE_MAILER_USERCRED,
                pass: process.env.NODE_MAILER_PASSCRED
            }
        });
        
        // Email template for successful password reset
        const confirmationTemplate = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background-color: #4a6da7; color: white; padding: 10px; text-align: center; }
                        .content { padding: 20px; border: 1px solid #ddd; }
                        .footer { font-size: 12px; text-align: center; margin-top: 20px; color: #777; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>Password Reset Successful</h2>
                        </div>
                        <div class="content">
                            <p>Hello ${user.name},</p>
                            <p>Your password has been successfully reset.</p>
                            <p>If you did not make this change, please contact our support team immediately.</p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message, please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} UMI Research Management System</p>
                        </div>
                    </div>
                </body>
            </html>
        `;
        
        // Send confirmation email
        await transporter.sendMail({
            from: `"UMI Research Management" <${process.env.NODE_MAILER_USERCRED}>`,
            to: user.email,
            subject: 'Password Reset Successful',
            html: confirmationTemplate
        });
        
        res.status(200).json({
            message: 'Password has been reset successfully'
        });
    } catch (error) {
        console.error('Password reset error:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/** GRADUATION MANAGEMENT */
/**
 * Get all students with senate-approved results who are eligible for graduation
 * @route GET /api/v1/management/students/senate-approved
 * @access Private - Admin only
 */
// export const getSenateApprovedStudents = async (req, res, next) => {
//     try {
//         // Get all students with their current status being "results approved by senate"
//         const students = await prisma.student.findMany({
//             include: {
//               studentStatuses: {
//                 include: {
//                   definition: true,
//                   notifications: true
//                 },
//                 orderBy: {
//                   startDate: 'desc'
//                 }
//               }
//             }
//           });
//         // const students = await prisma.student.findMany({
//         //     where: {
//         //         statuses: {
//         //             some: {
//         //                 isCurrent: true,
//         //                 definition: {
//         //                     name: 'results approved by senate'
//         //                 }
//         //             }
//         //         }
//         //     },
//         //     include: {
//         //         statuses: {
//         //             where: {
//         //                 isCurrent: true
//         //             },
//         //             include: {
//         //                 definition: true
//         //             }
//         //         },
//         //         supervisor: {
//         //             select: {
//         //                 name: true
//         //             }
//         //         },
//         //         program: {
//         //             select: {
//         //                 name: true
//         //             }
//         //         },
//         //         thesis: {
//         //             select: {
//         //                 title: true
//         //             }
//         //         }
//         //     },
//         //     orderBy: {
//         //         lastName: 'asc'
//         //     }
//         // });

//         // Format the response data
//         const formattedStudents = students.map(student => ({
//             id: student?.id,
//             studentNumber: student?.studentNumber,
//             name: `${student?.firstName} ${student?.lastName}`,
//             program: student?.program?.name || 'N/A',
//             supervisor: student?.supervisor?.name || 'N/A',
//             thesisTitle: student?.thesis?.title || 'N/A',
//             currentStatus: student?.statuses[0]?.definition?.name || 'N/A',
//             isInGraduationList: student?.statuses[0]?.definition?.name === 'graduated'
//         }));

//         res.status(200).json({
//             success: true,
//             count: formattedStudents.length,
//             students: formattedStudents // Changed from data to students to match frontend expectations
//         });
//     } catch (error) {
//         console.error('Error fetching senate approved students:', error);
//         if (!error.statusCode) {
//             error.statusCode = 500;
//         }
//         next(error);
//     }
// };

/**
 * Add a student to the graduation list
 * @route POST /api/v1/management/graduation
 * @access Private - Admin only
 */
// export const addStudentToGraduation = async (req, res, next) => {
//     try {
//         const { studentId, academicYear } = req.body;

//         if (!studentId || !academicYear) {
//             const error = new Error('Student ID and academic year are required');
//             error.statusCode = 400;
//             throw error;
//         }

//         // Update the student status to GRADUATED and set the academic year
//         const updatedStudent = await prisma.student.update({
//             where: {
//                 id: studentId
//             },
//             data: {
//                 status: 'GRADUATED',
//                 academicYear: academicYear
//             }
//         });

//         res.status(200).json({
//             success: true,
//             message: 'Student added to graduation list successfully',
//             data: updatedStudent
//         });
//     } catch (error) {
//         if (!error.statusCode) {
//             error.statusCode = 500;
//         }
//         next(error);
//     }
// };


export const getGraduationStatistics = async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const currentAcademicYear = `${currentYear}/${currentYear + 1}`;
  
      // Get total graduates
      const totalGraduates = await prisma.student.count({
        where: {
          statuses: {
            some: {
              definition: {
                name: 'graduated'
              }
            }
          }
        }
      });
  
      // Get current year graduates
      const currentYearGraduates = await prisma.student.count({
        where: {
            statuses: {
                some: {
                definition: {
                    name: 'graduated'
                }
                }
            },
          gradAcademicYear: currentAcademicYear
        }
      });
  
      // Get pending graduation (senate approved)
      const pendingGraduation = await prisma.student.count({
        where: {
          statuses: {
            some: {
              definition: {
                name: 'results approved by senate'
              }
            }
          }
        }
      });
  
      // Get yearly trends
      const yearlyTrends = await prisma.student.groupBy({
        by: ['gradAcademicYear', 'programLevel'],
        where: {
          statuses: {
            some: {
              definition: {
                name: 'graduated'
              }
            }
          },
          gradAcademicYear: {
            not: null
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          gradAcademicYear: 'asc'
        },
        take: 6 // Last 6 academic years
      });
  
      // Transform data for graph
      const trends = yearlyTrends.reduce((acc, curr) => {
        const year = curr.gradAcademicYear;
        if (!acc[year]) {
          acc[year] = { 
            academicYear: year, 
            graduates: 0, 
            phd: 0, 
            masters: 0 
          };
        }
        acc[year].graduates += curr._count.id;
        if (curr.programLevel.includes('PHD')) {
          acc[year].phd += curr._count.id;
        } else {
          acc[year].masters += curr._count.id;
        }
        return acc;
      }, {});
  
      res.json({
        totalGraduates,
        currentYearGraduates,
        pendingGraduation,
        yearlyTrends: Object.values(trends)
      });
    } catch (error) {
      console.error('Error fetching graduation statistics:', error);
      res.status(500).json({ message: 'Error fetching graduation statistics' });
    }
  };
  
  export const addStudentToGraduation = async (req, res) => {
    const { studentId, academicYear } = req.body; // academicYear format: "2023/2024"
  
    try {
      // Start a transaction
      const result = await prisma.$transaction(async (prisma) => {
        // Find the graduated status definition
        const graduatedStatusDef = await prisma.statusDefinition.findFirst({
          where: { name: 'graduated' }
        });
        
        if (!graduatedStatusDef) {
          throw new Error('Graduated status definition not found');
        }
        
        // Update all current statuses to not current
        await prisma.studentStatus.updateMany({
          where: { 
            studentId,
            isCurrent: true 
          },
          data: { isCurrent: false, endDate: new Date() }
        });
        
        // Create new student status
        await prisma.studentStatus.create({
          data: {
            student: {connect: {id: studentId}},
            definition: { connect: { id: graduatedStatusDef.id } },
            startDate: new Date(),
            isCurrent: true,
            updatedBy: {connect: {id: req.user.id}} // Assuming req.user contains the logged-in user
          }
        });
        
        // Update student
        const updatedStudent = await prisma.student.update({
          where: { id: studentId },
          data: {
            currentStatus: 'graduated',
            gradAcademicYear: academicYear,
            graduatedAt: new Date()
          }
        });
  
        // Create graduation record
        await prisma.graduation.create({
          data: {
            studentId,
            academicYear: academicYear,
            programLevel: updatedStudent.programLevel,
            graduationDate: new Date(),
          }
        });
  
        return updatedStudent;
      });
  
      res.json(result);
    } catch (error) {
      console.error('Error adding student to graduation:', error);
      res.status(500).json({ message: 'Error adding student to graduation' });
    }
  };

/* ********** RESEARCH REQUEST MANAGEMENT ********** */

// Get all research requests for management
export const getAllResearchRequests = async (req, res, next) => {
  try {
    const requests = await prisma.researchRequest.findMany({
      orderBy: { submittedAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            registrationNumber: true,
            email: true
          }
        }
      }
    });

    res.status(200).json({
      message: "Research requests retrieved successfully",
      requests
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Update research request status and decision
export const updateResearchRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, decision } = req.body;

    

    // Validate status
    const validStatuses = ['PENDING','IN_REVIEW', 'BEING_PROCESSED', 'CONCLUDED'];
    if (status && !validStatuses.includes(status)) {
      const error = new Error("Invalid status. Must be one of: PENDING, IN_REVIEW, BEING_PROCESSED, CONCLUDED");
      error.statusCode = 400;
      throw error;
    }

    // Find and update the research request
    const updatedRequest = await prisma.researchRequest.update({
      where: { id },
      data: {
        status: status || undefined,
        decision: decision || undefined,
        responseDate: new Date()
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            registrationNumber: true,
            email: true
          }
        }
      }
    });

    res.status(200).json({
      message: "Research request updated successfully",
      request: updatedRequest
    });

  } catch (error) {
    if (error.code === 'P2025') {
      // Prisma record not found error
      const error = new Error("Research request not found");
      error.statusCode = 404;
      throw error;
    }
    
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/* ********** END OF RESEARCH REQUEST MANAGEMENT ********** */