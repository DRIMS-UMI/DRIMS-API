import prisma from '../../../utils/db.mjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import PDFNet from '@pdftron/pdfnet-node';



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
        const submittedById = req.user.id;

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
                reviewers: true,
                student: true,
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

        // Check if reviewer is assigned to proposal
        const isReviewerAssigned = proposal.reviewers.some(reviewer => reviewer.id === reviewerId);

        if (!isReviewerAssigned) {
            const error = new Error('Reviewer is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        let updatedOrNewGrade;
        // Create or update the review grade
        const existingGrade = proposal.reviewGrades.find(grade => grade.gradedById === reviewerId);

        if (existingGrade) {
            // Update existing grade
            updatedOrNewGrade = await prisma.proposalReviewGrade.update({
                where: { id: existingGrade.id },
                data: { grade, feedback, updatedBy: { connect: { id: submittedById } } }
            });
        } else {
            // Create new grade
            updatedOrNewGrade = await prisma.proposalReviewGrade.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    gradedBy: { connect: { id: reviewerId } },
                    grade,
                    feedback,
                    submittedBy: { connect: { id: submittedById } }
                }
            });
        }

        // Calculate average grade after update
        const updatedProposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                reviewGrades: true,
                reviewers: true,
                student: true,
                statuses: {
                    include: {
                        definition: true
                    }
                }
            }
        });

        const totalGrades = updatedProposal.reviewGrades.reduce((sum, grade) => sum + grade.grade, 0);
        const averageGrade = totalGrades / updatedProposal.reviewGrades.length;

        // Update the proposal's average review mark
        await prisma.proposal.update({
            where: { id: proposalId },
            data: {
                averageReviewMark: averageGrade
            }
        });

        // Check if current status is already "Proposal Review Finished"
        const currentStatus = updatedProposal.statuses.find(status => status.isCurrent);
        const isAlreadyFinished = currentStatus?.definition?.name === 'proposal review finished';

        // Only update status if not already finished and all conditions are met
        if (!isAlreadyFinished && updatedProposal.reviewGrades.length === updatedProposal.reviewers.length && averageGrade >= 60) {
            // Update proposal status
            await prisma.proposalStatus.updateMany({
                where: {
                    proposalId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Get the status definition ID for "Proposal Review Finished"
            const proposalReviewFinishedStatus = await prisma.statusDefinition.findFirst({
                where: {
                    name: 'proposal review finished'
                }
            });

            if (!proposalReviewFinishedStatus) {
                throw new Error('Status definition not found');
            }

            await prisma.proposalStatus.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    definition: { connect: { id: proposalReviewFinishedStatus.id } },
                    isCurrent: true,
                    startDate: new Date()
                }
            });

            // Update student status if proposal passed review
            if (updatedProposal.student) {
                await prisma.studentStatus.updateMany({
                    where: {
                        studentId: updatedProposal.student.id,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        endDate: new Date()
                    }
                });

                // Get the status definition ID for "Proposal Review Passed"
                // const proposalReviewPassedStatus = await prisma.statusDefinition.findFirst({
                //     where: {
                //         name: 'Proposal Review Passed'
                //     }
                // });

                // if (!proposalReviewPassedStatus) {
                //     throw new Error('Status definition not found');
                // }

                await prisma.studentStatus.create({
                    data: {
                        student: { connect: { id: updatedProposal.student.id } },
                        definition: { connect: { id: proposalReviewFinishedStatus.id } },
                        isCurrent: true,
                        startDate: new Date(),
                        updatedBy: { connect: { id: submittedById } }
                    }
                });
            }
        }

        res.status(existingGrade ? 200 : 201).json({
            message: existingGrade ? 'Reviewer mark updated successfully' : 'Reviewer mark added successfully',
            grade: updatedOrNewGrade,
            averageGrade
        });

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
                defenseGrades: true,
                student: true,
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

        // Check if panelist is assigned to proposal
        const isPanelistAssigned = proposal.panelists.some(panelist => panelist.id === panelistId);

        if (!isPanelistAssigned) {
            const error = new Error('Panelist is not assigned to this proposal');
            error.statusCode = 400;
            throw error;
        }

        let resultingGrade;

        // Create or update the defense grade
        const existingGrade = proposal.defenseGrades.find(grade => grade.gradedById === panelistId);

        if (existingGrade) {
            // Update existing grade
            resultingGrade = await prisma.proposalDefenseGrade.update({
                where: { id: existingGrade.id },
                data: { grade, feedback, updatedBy: { connect: { id: req.user.id } } }
            });
        } else {
            // Create new grade
            resultingGrade = await prisma.proposalDefenseGrade.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    gradedBy: { connect: { id: panelistId } },
                    grade,
                    feedback,
                    submittedBy: { connect: { id: req.user.id } }
                }
            });
        }

        // Calculate average if there are multiple grades
        const updatedProposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: { defenseGrades: true }
        });

        if (updatedProposal.defenseGrades.length > 1) {
            const totalGrade = updatedProposal.defenseGrades.reduce((sum, grade) => sum + grade.grade, 0);
            const averageGrade = totalGrade / updatedProposal.defenseGrades.length;

            // Update proposal with average defense mark
            await prisma.proposal.update({
                where: { id: proposalId },
                data: {
                    averageDefenseMark: averageGrade
                }
            });

            // Update proposal status
            await prisma.proposalStatus.updateMany({
                where: {
                    proposalId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Get status definitions based on grade
            const passedStatus = await prisma.statusDefinition.findFirst({
                where: { name: 'passed-proposal graded' }
            });

            const failedStatus = await prisma.statusDefinition.findFirst({
                where: { name: 'failed-proposal graded' }
            });

            if (!passedStatus || !failedStatus) {
                throw new Error('Status definitions not found');
            }

            // Create new proposal status
            await prisma.proposalStatus.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    definition: {
                        connect: {
                            id: averageGrade >= 60 ? passedStatus.id : failedStatus.id
                        }
                    },
                    isCurrent: true,
                    startDate: new Date()
                }
            });

            // Update student status if student exists
            if (proposal.student) {
                // Set current student status to not current
                await prisma.studentStatus.updateMany({
                    where: {
                        studentId: proposal.student.id,
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
                        student: { connect: { id: proposal.student.id } },
                        definition: { 
                            connect: { 
                                id: averageGrade >= 60 ? passedStatus.id : failedStatus.id 
                            } 
                        },
                        isCurrent: true,
                        startDate: new Date(),
                        updatedBy: { connect: { id: req.user.id } }
                    }
                });
            }
        }

        res.status(existingGrade ? 200 : 201).json({
            message: existingGrade ? 'Panelist mark updated successfully' : 'Panelist mark added successfully',
            grade: resultingGrade
        });

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

// Add defense date to proposal
export const addDefenseDate = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { defenseDate, type } = req.body;

        // Validate input
        if (!proposalId || !defenseDate || !type) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
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

        // If type is reschedule, just update the defense date
        if (type === 'reschedule') {
            const updatedProposal = await prisma.proposal.update({
                where: { id: proposalId },
                data: {
                    defenseDate: new Date(defenseDate)
                }
            });

            return res.status(200).json({
                message: 'Defense date rescheduled successfully',
                proposal: updatedProposal
            });
        }

        // For new defense date scheduling, continue with status updates
        // Update current proposal status to not current
        await prisma.proposalStatus.updateMany({
            where: {
                proposalId,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                endDate: new Date()
            }
        });

        // Get the status definition for "waiting for proposal defense"
        const waitingForDefenseStatus = await prisma.statusDefinition.findFirst({
            where: {
                name: 'waiting for proposal defense'
            }
        });

        if (!waitingForDefenseStatus) {
            throw new Error('Status definition not found');
        }

        // Create new proposal status
        await prisma.proposalStatus.create({
            data: {
                proposal: { connect: { id: proposalId } },
                definition: { connect: { id: waitingForDefenseStatus.id } },
                isCurrent: true,
                startDate: new Date()
            }
        });

        // Update student status
        if (proposal.student) {
            // Set current student status to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: proposal.student.id,
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
                    student: { connect: { id: proposal.student.id } },
                    definition: { connect: { id: waitingForDefenseStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    updatedBy: { connect: { id: req.user.id } }
                }
            });
        }

        // Update proposal with defense date
        const updatedProposal = await prisma.proposal.update({
            where: { id: proposalId },
            data: {
                defenseDate: new Date(defenseDate)
            }
        });

        res.status(200).json({
            message: 'Defense date added successfully',
            proposal: updatedProposal
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

export const addComplianceReportDate = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { complianceReportDate } = req.body;

        // Validate input
        if (!proposalId || !complianceReportDate) {
            const error = new Error('Invalid input data');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
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

        // Get status definition for compliance report submitted
        const complianceReportSubmittedStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'compliance report submitted' }
        });

        if (!complianceReportSubmittedStatus) {
            throw new Error('Status definition not found');
        }

        // Update current status to not current
        await prisma.proposalStatus.updateMany({
            where: {
                proposalId,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                endDate: new Date()
            }
        });

        // Create new status for compliance report submitted
        await prisma.proposalStatus.create({
            data: {
                proposal: { connect: { id: proposalId } },
                definition: { connect: { id: complianceReportSubmittedStatus.id } },
                isCurrent: true,
                startDate: new Date()
            }
        });

        // Update student status if student exists
        if (proposal.student) {
            // Set current student status to not current
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: proposal.student.id,
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
                    student: { connect: { id: proposal.student.id } },
                    definition: { connect: { id: complianceReportSubmittedStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    updatedBy: { connect: { id: req.user.id } }
                }
            });
        }

        // Update proposal with compliance report date
        const updatedProposal = await prisma.proposal.update({
            where: { id: proposalId },
            data: {
                complianceReportDate: new Date(complianceReportDate),
               
            }
        });

        res.status(200).json({
            message: 'Compliance report date added successfully',
            proposal: updatedProposal
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Generate and send field letter controller
export const generateFieldLetter = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        // const { file: req.file } = req;
        const { emailTo } = req.body;
        console.log('here')
        // Validate file exists
        if (!req.file) {
            const error = new Error('No DOCX file provided');
            error.statusCode = 400;
            throw error;
        }

        // Get proposal with related data
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Get letter to field status definition
        const letterToFieldStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'letter to field issued' }
        });

        if (!letterToFieldStatus) {
            const error = new Error('Letter to field status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Get fieldwork status definition
        const fieldworkStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'fieldwork' }
        });

        if (!fieldworkStatus) {
            const error = new Error('Fieldwork status definition not found');
            error.statusCode = 404;
            throw error;
        }
        console.log('here ddddd')

        // Convert DOCX to PDF using PDFNet
        let pdfBuffer;
        try {
            pdfBuffer = await PDFNet.runWithCleanup(async () => {
                const pdfdoc = await PDFNet.PDFDoc.create();
                await pdfdoc.initSecurityHandler();
                
                // Create a temporary buffer from the uploaded file
                const docxBuffer = req.file.buffer;
                
                // Convert DOCX to PDF
                await PDFNet.Convert.toPdf(pdfdoc, docxBuffer);
                
                // Save to memory buffer
                return await pdfdoc.saveMemoryBuffer(PDFNet.SDFDoc.SaveOptions.e_linearized);
            });
        } catch (conversionError) {
            console.error('PDF conversion error:', conversionError);
            const error = new Error('Failed to convert DOCX to PDF');
            error.statusCode = 500;
            throw error;
        }

        console.log('here')
        // Send email with PDF attachment
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.NODE_MAILER_USERCRED,
                    pass: process.env.NODE_MAILER_PASSCRED
                }
            });

            await transporter.sendMail({
                to: process.env.NODE_MAILER_EMAIL_TO,
                cc: process.env.NODE_MAILER_EMAIL_CC,
                subject: `Field Letter - ${proposal.student.firstName} ${proposal.student.lastName}`,
                text: `Please find attached the field letter for ${proposal.student.firstName} ${proposal.student.lastName}`,
                attachments: [{
                    filename: `field-letter-${proposal.student.firstName}-${proposal.student.lastName}.pdf`,
                    content: pdfBuffer
                }]
            });
        } catch (emailError) {
            console.error('Failed to send email:', emailError);
        }

        // Database transaction
        const updatedProposal = await prisma.$transaction(async (prisma) => {
            // Update student status
            await prisma.studentStatus.updateMany({
                where: {
                    studentId: proposal.student.id,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            // Create letter to field status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: proposal.student.id } },
                    definition: { connect: { id: letterToFieldStatus.id } },
                    isCurrent: false,
                    startDate: new Date(),
                    endDate: new Date(),
                    updatedBy: { connect: { id: req.user.id } }
                }
            });

            // Create fieldwork status
            await prisma.studentStatus.create({
                data: {
                    student: { connect: { id: proposal.student.id } },
                    definition: { connect: { id: fieldworkStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    updatedBy: { connect: { id: req.user.id } }
                }
            });

            // Store the PDF file
            const pdfDoc = await prisma.letterDocument.create({
                data: {
                    name: `field-letter-${proposal.student.firstName}-${proposal.student.lastName}.pdf`,
                    type: 'FIELD_LETTER',
                    file: pdfBuffer,
                    proposal: { connect: { id: proposalId } },
                    uploadedBy: { connect: { id: req.user.id } }
                }
            });

            // Update proposal statuses
            await prisma.proposalStatus.updateMany({
                where: {
                    proposalId: proposalId,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    endDate: new Date()
                }
            });

            await prisma.proposalStatus.create({
                data: {
                    proposal: { connect: { id: proposalId } },
                    definition: { connect: { id: letterToFieldStatus.id } },
                    isCurrent: true,
                    startDate: new Date(),
                    endDate: new Date()
                }
            });

            // Update proposal
            return await prisma.proposal.update({
                where: { id: proposalId },
                data: {
                    fieldLetterDate: new Date(),
                }
            });
        });

        res.status(200).json({
            message: 'Field letter processed and sent successfully',
            proposal: updatedProposal
        });

    } catch (error) {
        console.error('Error in generateFieldLetter:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    } finally {
        PDFNet.shutdown();
    }
};

/**
 * Update field letter date for a proposal
 * @route PUT /api/v1/faculty/field-letter-date/:proposalId
 * @access Private (School Admin)
 */
export const updateFieldLetterDate = async (req, res, next) => {
    try {
        const { proposalId } = req.params;
        const { fieldLetterDate } = req.body;

        if (!fieldLetterDate) {
            const error = new Error('Field letter date is required');
            error.statusCode = 400;
            throw error;
        }

        // Validate date format
        const dateObj = new Date(fieldLetterDate);
        if (isNaN(dateObj.getTime())) {
            const error = new Error('Invalid date format');
            error.statusCode = 400;
            throw error;
        }

        // Check if proposal exists
        const proposal = await prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                student: true,
            }
        });

        if (!proposal) {
            const error = new Error('Proposal not found');
            error.statusCode = 404;
            throw error;
        }

        // Get letter to field status definition
        const letterToFieldStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'letter to field issued' }
        });

        if (!letterToFieldStatus) {
            const error = new Error('Letter to field status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Get fieldwork status definition
        const fieldworkStatus = await prisma.statusDefinition.findFirst({
            where: { name: 'fieldwork' }
        });

        if (!fieldworkStatus) {
            const error = new Error('Fieldwork status definition not found');
            error.statusCode = 404;
            throw error;
        }

        // Update student status
        await prisma.studentStatus.updateMany({
            where: {
                studentId: proposal.student.id,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                endDate: new Date()
            }
        });

        // Create letter to field status
        await prisma.studentStatus.create({
            data: {
                student: { connect: { id: proposal.student.id } },
                definition: { connect: { id: letterToFieldStatus.id } },
                isCurrent: false,
                startDate: new Date(),
                endDate: new Date(),
                updatedBy: { connect: { id: req.user.id } }
            }
        });

        // Create fieldwork status
        await prisma.studentStatus.create({
            data: {
                student: { connect: { id: proposal.student.id } },
                definition: { connect: { id: fieldworkStatus.id } },
                isCurrent: true,
                startDate: new Date(),
                updatedBy: { connect: { id: req.user.id } }
            }
        });

        // Update proposal statuses
        await prisma.proposalStatus.updateMany({
            where: {
                proposalId: proposalId,
                isCurrent: true
            },
            data: {
                isCurrent: false,
                endDate: new Date()
            }
        });

        await prisma.proposalStatus.create({
            data: {
                proposal: { connect: { id: proposalId } },
                definition: { connect: { id: letterToFieldStatus.id } },
                isCurrent: true,
                startDate: new Date(),
                endDate: new Date()
            }
        });

        // Update the field letter date
        const updatedProposal = await prisma.proposal.update({
            where: { id: proposalId },
            data: {
                fieldLetterDate: new Date(fieldLetterDate)
            }
        });

        res.status(200).json({
            message: 'Field letter date updated successfully',
            proposal: updatedProposal
        });

    } catch (error) {
        console.error('Error in updateFieldLetterDate:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};










