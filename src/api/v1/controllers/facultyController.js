import prisma from '../../../utils/db.mjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Faculty login controller
export const loginFaculty = async (req, res, next) => {
    try {
        const { email, password, rememberMe } = req.body;

        // Find faculty member by email
        const user = await prisma.user.findUnique({
            where: { email },
            
        });

        if (!user) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if user has correct role
        if (user.role !== 'SCHOOL_ADMIN' && user.role !== 'FACULTY') {
            const error = new Error('Unauthorized access - must be School Admin or Faculty');
            error.statusCode = 403;
            throw error;
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            const error = new Error('Invalid password');
            error.statusCode = 401;
            throw error;
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                designation: user.designation
            },
            process.env.AUTH_SECRET,
            { expiresIn: rememberMe ? '30d' : '24h' }
        );

        // Return user data and token
        res.status(200).json({
            token,
            faculty: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get faculty profile controller
export const getFacultyProfile = async (req, res, next) => {
    try {
        const facultyId = req.user.id;

        const faculty = req.user;

        if (!faculty) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            faculty: {
                id: faculty.id,
                name: faculty.name,
                email: faculty.email,
                role: faculty.role,
                designation: faculty.designation,
                department: faculty.department,
                createdAt: faculty.createdAt,
                updatedAt: faculty.updatedAt
            }
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Update faculty password controller
export const updateFacultyPassword = async (req, res, next) => {
    try {
        const facultyId = req.user.userId;
        const { currentPassword, newPassword } = req.body;

        // Find faculty member
        const faculty = await prisma.faculty.findUnique({
            where: { id: facultyId }
        });

        if (!faculty) {
            const error = new Error('Faculty member not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, faculty.password);
        if (!isValidPassword) {
            const error = new Error('Current password is incorrect');
            error.statusCode = 401;
            throw error;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await prisma.faculty.update({
            where: { id: facultyId },
            data: { password: hashedPassword }
        });

        res.status(200).json({
            message: 'Password updated successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


/** STUDENT MANAGEMENT CONTROLLERS */

// Get student by ID controller
export const getStudent = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    include: {
                        definition: true
                    }
                    },
                supervisors: true,
                proposals: true,
                notifications: true,
                fieldWork: true,
                vivas: true,
                school: true,
                campus: true,
                department: true,
                user: true
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            student
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get all students controller
export const getAllStudents = async (req, res, next) => {
    try {
        // Get the faculty member's school and campus from the request
        const { schoolId, campusId } = req.user;

        const students = await prisma.student.findMany({
            where: {
                schoolId,
                campusId
            },
            include: {
                statuses: {
                    include: {
                        definition: true
                    }
                },
                supervisors: true,
                proposals: true,
                notifications: true,
                fieldWork: true,
                vivas: true,
                school: true,
                campus: true,
                department: true,
                user: true
            }
        });

        res.status(200).json({
            students
        });
    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Controller to get student statuses with update history
export const getStudentStatuses = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    include: {
                        definition: true,
                        updatedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        },
                        notificationsSent: {
                            select: {
                                recipients: true,
                                type: true,
                                message: true,
                                sentAt: true,
                                studentStatus: true
                            }
                        }
                    },
                    orderBy: {
                        updatedAt: 'desc'
                    }
                }
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            statuses: student.statuses
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

/** PROPOSAL MANAGEMENT CONTROLLERS */
// Submit proposal for student
export const submitProposal = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { title, description, submissionDate, researchArea } = req.body;
        console.log("file", req.file);
        const proposalFile = req.file;

        if (!proposalFile) {
            const error = new Error('No proposal file uploaded');
            error.statusCode = 400;
            throw error;
        }

        // Check if student exists
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    where: {
                        isCurrent: true
                    },
                    take: 1
                }
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Create new proposal with file buffer
        const proposal = await prisma.proposal.create({
            data: {
                title,
                description,
                submissionDate: new Date(submissionDate),
                researchArea,
                fileData: proposalFile.buffer,
                fileName: proposalFile.originalname,
                fileType: proposalFile.mimetype,
                isCurrent: true,
                
                student: {
                    connect: { id: studentId }
                },
                submittedBy: {
                    connect: { id: req.user.id }
                }
            }
        });

        // Update current status to not be current
        if (student.statuses[0]) {
            await prisma.studentStatus.update({
                where: { id: student.statuses[0].id },
                data: { 
                    isCurrent: false,
                    endDate: new Date() 
                }
            });
        }

        let statusDefinition = await prisma.statusDefinition.findUnique({
            where: { name: 'proposal received' }
        });

        if (!statusDefinition) {
            statusDefinition = await prisma.statusDefinition.create({   
                data: {
                    name: 'Proposal Received',
                    description: 'Proposal has been received by the faculty member'
                }
            });
        }   

        // Create new status record for proposal submission
        await prisma.studentStatus.create({
            data: {
                student: {
                    connect: { id: studentId }
                },
                definition: {
                    connect: { id: statusDefinition.id }
                },
                updatedBy: {
                    connect: { id: req.user.id }
                },
                startDate: new Date(),
                isCurrent: true
            }
        });

        // Create initial proposal status
        await prisma.proposalStatus.create({
            data: {
                proposal: {
                    connect: { id: proposal.id }
                },
                definition: {
                    connect: { id: statusDefinition.id }
                },
                startDate: new Date(),
                isActive: true,
                isCurrent: true
            }
        });

        res.status(201).json({
            message: 'Proposal submitted successfully',
            proposal: {
                id: proposal.id,
                title: proposal.title,
                submissionDate: proposal.submissionDate,
                fileName: proposal.fileName,
                status: proposal.status
            }
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};



// Get all proposals for a student
export const getStudentProposals = async (req, res, next) => {
    try {
        const { studentId } = req.params;

        const proposals = await prisma.proposal.findMany({
            where: {
                studentId: studentId
            },
            include: {
                student: true,
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                reviewGrades: true,
                defenseGrades: true,
                reviewers: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                panelists: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                statuses: {
                    include: {
                        definition: true
                    }
                }
            },
            orderBy: {
                submittedAt: 'desc'
            }
        });

        res.status(200).json({ proposals });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get all proposals in a school
export const getSchoolProposals = async (req, res, next) => {
    try {
        // Get faculty member's school from their profile
        const faculty = await prisma.facultyMember.findUnique({
            where: { userId: req.user.id },
            include: {
                campus: true,
                school: true
            }
        });

        if (!faculty || !faculty.campusId) {
            const error = new Error('Faculty member not found or not associated with a campus');
            error.statusCode = 404;
            throw error;
        }

        // Get all proposals from students in the same campus
        const proposals = await prisma.proposal.findMany({
            where: {
                student: {
                    AND: [
                        { campusId: faculty.campusId },
                        { schoolId: faculty.schoolId }
                    ]
                }
            },
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                reviewGrades: {
                    select: {
                        id: true,
                        grade: true,
                        feedback: true,
                        createdAt: true,
                        gradedBy: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        submittedBy: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                defenseGrades: {
                    select: {
                        id: true,
                        grade: true,
                        feedback: true,
                        createdAt: true,
                        gradedBy: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        submittedBy: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                panelists: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
               
                statuses: {
                    include: {
                        definition: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 1
                }
            },
            orderBy: {
                submittedAt: 'desc'
            }
        });

        res.status(200).json({
            message: 'Proposals retrieved successfully',
            proposals: proposals
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get proposal details
export const getProposal = async (req, res, next) => {
    try {
        const { proposalId } = req.params;

        const proposal = await prisma.proposal.findFirst({
            where: {
                id: proposalId,
            
            },
            include: {
                student: true,
                submittedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                reviewers: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                panelists: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                defenseGrades: true,
                reviewGrades: true,
                statuses: {
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({ proposal });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};



// Grade proposal
export const gradeProposal = async (req, res, next) => {
    try {
        const { studentId, proposalId } = req.params;
        const { grade, feedback } = req.body;

        const proposal = await prisma.proposal.findFirst({
            where: {
                id: proposalId,
                studentId: studentId
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Create grade for proposal
        const gradedProposal = await prisma.proposalGrade.create({
            data: {
                grade,
                feedback,
                proposal: {
                    connect: { id: proposalId }
                },
                gradedBy: {
                    connect: { id: req.user.id }
                }
            }
        });

        // Update student status
        await prisma.studentStatus.create({
            data: {
                student: {
                    connect: { id: studentId }
                },
                definition: {
                    connect: { code: 'PROPOSAL_GRADED' }
                },
                updatedBy: {
                    connect: { id: req.user.id }
                }
            }
        });

        res.status(200).json({
            message: 'Proposal graded successfully',
            grade: gradedProposal
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Add reviewers to proposal
export const addReviewers = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { reviewers } = req.body;

        // Validate input
        if (!proposalId || !reviewers || !Array.isArray(reviewers)) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Validate reviewer objects
        for (const reviewer of reviewers) {
            if (!reviewer.name || !reviewer.email) {
                const error = new Error('Each reviewer must have name and email');
                error.statusCode = 400;
                throw error;
            }
        }

        // Get proposal with student details and current status
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
                reviewers: true,
                statuses: {
                   
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        if (!proposal.student) {
            const error = new Error('Student not found for this proposal');
            error.statusCode = 404;
            throw error;
        }

        // Get user's campus
        const faculty = await prisma.facultyMember.findUnique({
            where: { userId: req.user.id },
            include: {
                campus: true
            }
        });

        if (!faculty || !faculty.campus) {
            const error = new Error('Faculty member or campus not found');
            error.statusCode = 404;
            throw error;
        }

        // Create reviewers if they don't exist and connect to proposal and campus
        const reviewerPromises = reviewers.map(async ({ name, email }) => {
            const reviewer = await prisma.reviewer.upsert({
                where: { email },
                update: {
                    name,
                    proposals: {
                        connect: { id: proposalId }
                    },
                    campus: {
                        connect: { id: faculty.campusId }
                    }
                },
                create: {
                    email,
                    name,
                    proposals: {
                        connect: { id: proposalId }
                    },
                    campus: {
                        connect: { id: faculty.campusId }
                    }
                }
            });
            return reviewer;
        });

        const createdReviewers = await Promise.all(reviewerPromises);

        // Update proposal with reviewer connections
        await prisma.proposal.update({
            where: { id: proposalId },
            data: {
                reviewers: {
                    connect: createdReviewers.map(r => ({ id: r.id }))
                }
            }
        });

        // Check if we need to update the proposal status
        // const needsStatusUpdate = 
        //     proposal.statuses.length === 0 ||     !proposal.statuses.some(status => status.definition.name.toLowerCase() === 'proposal in review') ||
        //     proposal.reviewers.length === 0;

            const needsStatusUpdate = 
            proposal.statuses.length === 0 || 
            !proposal.statuses.some(status => status.definition.name.toLowerCase() === 'proposal in review') 

        if (needsStatusUpdate) {
            // Find the status definition for 'proposal in review'
            const statusDefinition = await prisma.statusDefinition.findUnique({
                where: { name: 'proposal in review' }
            });

            if (!statusDefinition) {
                const error = new Error('Status definition not found');
                error.statusCode = 500;
                throw error;
            }

            const currentDate = new Date();
            
            // Set current status to false for all existing statuses and add end date
            if (proposal.statuses.length > 0) {
                await prisma.proposalStatus.updateMany({
                    where: { proposalId },
                    data: { 
                        isCurrent: false,
                        endDate: currentDate
                    }
                });
            }

            // Update previous student statuses to not current and set end date
            await prisma.studentStatus.updateMany({
                where: { 
                    studentId: proposal.student.id,
                    isCurrent: true
                },
                data: { 
                    isCurrent: false,
                    endDate: currentDate
                }
            });

            // Create new proposal status
            await prisma.proposalStatus.create({
                data: {
                    proposal: {
                        connect: { id: proposalId }
                    },
                    definition: {
                        connect: { id: statusDefinition.id }
                    },
                    startDate: new Date(),
                    isActive: true,
                    isCurrent: true
                }
            });

            // Update student status using the student from the proposal
            await prisma.studentStatus.create({
                data: {
                    student: {
                        connect: { id: proposal.student.id }
                    },
                    definition: {
                        connect: { id: statusDefinition.id }
                    },
                    updatedBy: {
                        connect: { id: req.user.id }
                    },
                    startDate: new Date(),
                    isCurrent: true
                }
            });
        }

        res.status(200).json({
            message: 'Reviewers added successfully',
            reviewers: createdReviewers
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get reviewers for a campus
export const getReviewers = async (req, res, next) => {
    try {
        // Get faculty member to retrieve campus ID
        const facultyMember = await prisma.facultyMember.findUnique({
            where: {
                userId: req.user.id
            },
            select: {
                campusId: true
            }
        });

        if (!facultyMember || !facultyMember.campusId) {
            const error = new Error('Faculty member campus not found');
            error.statusCode = 400;
            throw error;
        }

        // Get all reviewers for the faculty member's campus
        const reviewers = await prisma.reviewer.findMany({
            where: {
                campusId: facultyMember.campusId
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.status(200).json({
            message: 'Reviewers retrieved successfully',
            reviewers: reviewers
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Add reviewer mark to proposal
export const addReviewerMark = async (req, res, next) => {
    try {
        const { proposalId, reviewerId } = req.params;
        const { grade, feedback } = req.body;

        // Get the currently logged-in faculty user
        const submittedById = req.user.id; // Assuming req.user contains the logged-in user's information

        // Validate input
        if (!proposalId || !reviewerId || grade === undefined || !feedback) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                reviewGrades: true,
                reviewers: true
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if reviewer is assigned to proposal
        const isReviewerAssigned = proposal.reviewers.some(reviewer => reviewer.id === reviewerId);

        if (!isReviewerAssigned) {
            const error = new Error('Reviewer is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        // Create or update the review grade
        const existingGrade = proposal.reviewGrades.find(grade => grade.reviewerId === reviewerId);

        if (existingGrade) {
            // Update existing grade
            const updatedGrade = await prisma.proposalReviewGrade.update({
                where: { id: existingGrade.id },
                data: { grade, feedback, submittedBy: { connect: { id: submittedById } } } // Connect the submittedById
            });
            res.status(200).json({
                message: 'Reviewer mark updated successfully',
                grade: updatedGrade
            });
        } else {
            // Create new grade
            const newGrade = await prisma.proposalReviewGrade.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    gradedBy: { connect: { id: reviewerId } },
                    grade,
                    feedback,
                    submittedBy: { connect: { id: submittedById } } // Connect the submittedById
                }
            });
            res.status(201).json({
                message: 'Reviewer mark added successfully',
                grade: newGrade
            });
        }

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
}


// Delete reviewer from proposal
export const deleteReviewer = async (req, res, next) => {
    try {
        const { proposalId, reviewerId } = req.params;

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: {
                id: proposalId
            },
            include: {
                reviewers: true,
                reviewGrades: true
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if reviewer is assigned to proposal
        const isReviewerAssigned = proposal.reviewers.some(reviewer => reviewer.id === reviewerId);

        if (!isReviewerAssigned) {
            const error = new Error('Reviewer is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        // Check if reviewer has submitted any grades
        const hasGrades = proposal.reviewGrades.some(grade => grade.reviewerId === reviewerId);

        if (hasGrades) {
            const error = new Error('Cannot remove reviewer who has already submitted grades');
            error.statusCode = 400;
            throw error;
        }

        // Check if reviewer has other proposals assigned
        const otherProposals = await prisma.proposal.findMany({
            where: {
                AND: [
                    {
                        reviewers: {
                            some: {
                                id: reviewerId
                            }
                        }
                    },
                    {
                        id: {
                            not: proposalId
                        }
                    }
                ]
            }
        });

        // Delete reviewer from proposal
        await prisma.proposal.update({
            where: {
                id: proposalId
            },
            data: {
                reviewers: {
                    disconnect: {
                        id: reviewerId
                    }
                }
            }
        });

        // If reviewer has no other proposals, delete the reviewer
        if (otherProposals.length === 0) {
            await prisma.reviewer.delete({
                where: {
                    id: reviewerId
                }
            });
        }

        res.status(200).json({
            message: 'Reviewer removed successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Get panelists for a campus
export const getPanelists = async (req, res, next) => {
    try {
        // Get faculty member to retrieve campus ID
        const facultyMember = await prisma.facultyMember.findUnique({
            where: {
                userId: req.user.id
            },
            select: {
                campusId: true
            }
        });

        if (!facultyMember || !facultyMember.campusId) {
            const error = new Error('Faculty member campus not found');
            error.statusCode = 400;
            throw error;
        }

        // Get all panelists for the faculty member's campus
        const panelists = await prisma.panelist.findMany({
            where: {
                campusId: facultyMember.campusId
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.status(200).json({
            message: 'Panelists retrieved successfully',
            panelists: panelists
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Add panelists to proposal
export const addPanelists = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { panelists } = req.body;

        // Validate input
        if (!proposalId || !panelists || !Array.isArray(panelists)) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        console.log(panelists);

        // Validate panelist objects
        for (const panelist of panelists) {
            if (!panelist.name || !panelist.email) {
                const error = new Error('Each panelist must have name and email');
                error.statusCode = 400;
                throw error;
            }
        }

        // Get proposal with student details and current status
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
                panelists: true,
                statuses: {
                    where: {
                        isCurrent: true
                    },
                    include: {
                        definition: true
                    }
                }
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        if (!proposal.student) {
            const error = new Error('Student not found for this proposal');
            error.statusCode = 404;
            throw error;
        }

        // Get user's campus
        const faculty = await prisma.facultyMember.findUnique({
            where: { userId: req.user.id },
            select: { campusId: true }
        });

        if (!faculty || !faculty.campusId) {
            const error = new Error('Faculty campus not found');
            error.statusCode = 404;
            throw error;
        }

        // Process each panelist
        const panelistsToAdd = [];
        for (const panelist of panelists) {
            // Check if panelist already exists
            let existingPanelist = await prisma.panelist.findFirst({
                where: {
                    email: panelist.email,
                    campusId: faculty.campusId
                }
            });

            // Create panelist if doesn't exist
            if (!existingPanelist) {
                existingPanelist = await prisma.panelist.create({
                    data: {
                        name: panelist.name,
                        email: panelist.email,
                        campus: {
                            connect: { id: faculty.campusId }
                        }
                    }
                });
            }

            // Check if panelist is already assigned to this proposal
            const alreadyAssigned = proposal.panelists.some(p => p.id === existingPanelist.id);
            if (!alreadyAssigned) {
                panelistsToAdd.push(existingPanelist.id);
            }
        }

        // Add panelists to proposal
        if (panelistsToAdd.length > 0) {
            await prisma.proposal.update({
                where: { id: proposalId },
                data: {
                    panelists: {
                        connect: panelistsToAdd.map(id => ({ id }))
                    }
                }
            });
        }

        // Get updated proposal with panelists
        const updatedProposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                panelists: true
            }
        });

        res.status(200).json({
            message: 'Panelists added successfully',
            panelists: updatedProposal.panelists
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

export const addPanelistMark = async (req, res, next) => {
    try {
        const { proposalId, panelistId } = req.params;
        const { grade, feedback } = req.body;

        // Validate input
        if (!proposalId || !panelistId || grade === undefined || feedback === undefined) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                panelists: true,
                defenseGrades: true
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if panelist is assigned to proposal
        const isPanelistAssigned = proposal.panelists.some(panelist => panelist.id === panelistId);

        if (!isPanelistAssigned) {
            const error = new Error('Panelist is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        // Create or update the defense grade
        const existingGrade = proposal.defenseGrades.find(grade => grade.panelistId === panelistId);

        if (existingGrade) {
            // Update existing grade
            const updatedGrade = await prisma.proposalDefenseGrade.update({
                where: { id: existingGrade.id },
                data: { grade, feedback, submittedBy: { connect: { id: req.user.id } } } // Connect the submittedById
            });
            res.status(200).json({
                message: 'Panelist mark updated successfully',
                grade: updatedGrade
            });
        } else {
            // Create new grade
            const newGrade = await prisma.proposalDefenseGrade.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    gradedBy: { connect: { id: panelistId } },
                    grade,
                    feedback,
                    submittedBy: { connect: { id: req.user.id } } // Connect the submittedById
                }
            });
            res.status(201).json({
                message: 'Panelist mark added successfully',
                grade: newGrade
            });
        }

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};


// Delete panelist from proposal
export const deletePanelist = async (req, res, next) => {
    try {
        const { proposalId, panelistId } = req.params;

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: {
                id: proposalId
            },
            include: {
                panelists: true,
                defenseGrades: true
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if panelist is assigned to proposal
        const isPanelistAssigned = proposal.panelists.some(panelist => panelist.id === panelistId);

        if (!isPanelistAssigned) {
            const error = new Error('Panelist is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        // Check if panelist has submitted any grades
        const hasGrades = proposal.defenseGrades.some(grade => grade.panelistId === panelistId);

        if (hasGrades) {
            const error = new Error('Cannot remove panelist who has already submitted grades');
            error.statusCode = 400;
            throw error;
        }

        // Check if panelist has other proposals assigned
        const otherProposals = await prisma.proposal.findMany({
            where: {
                AND: [
                    {
                        panelists: {
                            some: {
                                id: panelistId
                            }
                        }
                    },
                    {
                        id: {
                            not: proposalId
                        }
                    }
                ]
            }
        });

        // Delete panelist from proposal
        await prisma.proposal.update({
            where: {
                id: proposalId
            },
            data: {
                panelists: {
                    disconnect: {
                        id: panelistId
                    }
                }
            }
        });

        // If panelist has no other proposals, delete the panelist and disconnect from all relations
        if (otherProposals.length === 0) {
            // First disconnect from all proposals
            // await prisma.proposal.updateMany({
            //     where: {
            //         panelists: {
            //             some: {
            //                 id: panelistId
            //             }
            //         }
            //     },
            //     data: {
            //         panelists: {
            //             disconnect: {
            //                 id: panelistId
            //             }
            //         }
            //     }
            // });

            // Then delete the panelist
            await prisma.panelist.delete({
                where: {
                    id: panelistId
                }
            });
        }

        res.status(200).json({
            message: 'Panelist removed successfully'
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};




