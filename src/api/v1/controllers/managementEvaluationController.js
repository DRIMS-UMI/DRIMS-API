import prisma from '../../../utils/db.mjs';

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