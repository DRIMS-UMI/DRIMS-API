import prisma from "../../../utils/db.mjs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import emailService from "../../../services/emailService.js";
import { notificationService } from "../../../services/notificationService.js";
import mongoose from "mongoose";
import { conn, gfs } from "../../../utils/db.mjs";

// Faculty login controller
export const loginFaculty = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Find faculty member by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const error = new Error("Faculty member not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if user is active
    if (!user.isActive) {
      const error = new Error(
        "Your account has been deactivated. Please contact the administrator."
      );
      error.statusCode = 403;
      throw error;
    }

    // Check if user has correct role
    if (user.role !== "SCHOOL_ADMIN" && user.role !== "FACULTY") {
      const error = new Error(
        "Unauthorized access - must be School Admin or Faculty"
      );
      error.statusCode = 403;
      throw error;
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const error = new Error("Invalid password");
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        title: user.title,
        email: user.email,
        name: user.name,
        role: user.role,
        designation: user.designation,
        loggedInAt: new Date(),
        phone: user.phone,
      },
      process.env.AUTH_SECRET,
      { expiresIn: rememberMe ? "30d" : "24h" }
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
        updatedAt: user.updatedAt,
      },
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
      const error = new Error("Faculty member not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      faculty: {
        id: faculty.id,
        name: faculty.name,
        email: faculty.email,
        role: faculty.role,
        title: faculty.title,
        phone: faculty.phone,
        designation: faculty.designation,
        loggedInAt: faculty.loggedInAt,
        department: faculty.department,
        createdAt: faculty.createdAt,
        updatedAt: faculty.updatedAt,
      },
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
    const facultyId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Find faculty member
    const user = await prisma.user.findUnique({
      where: { id: facultyId },
    });

    if (!user) {
      const error = new Error("Faculty member not found");
      error.statusCode = 404;
      throw error;
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isValidPassword) {
      const error = new Error("Current password is incorrect");
      error.statusCode = 401;
      throw error;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: facultyId },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for updating logged in user details
export const updateFacultyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, name, phone, designation } = req.body;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        title,
        name,
        phone,
        designation,
      },
    });

    // Create user data object to return (excluding sensitive info)
    const userData = {
      id: updatedUser.id,
      title: updatedUser.title,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      designation: updatedUser.designation,
      phone: updatedUser.phone,
    };

    res.status(200).json({
      message: "Profile updated successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
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
            definition: true,
          },
        },
        supervisors: true,
        proposals: true,
        notifications: true,

        school: true,
        campus: true,
        department: true,
        user: true,
      },
    });

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      student,
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
        campusId,
      },
      include: {
        statuses: {
          include: {
            definition: true,
          },
        },
        supervisors: true,
        proposals: true,
        notifications: true,

        school: true,
        campus: true,
        department: true,
        user: true,
      },
    });

    res.status(200).json({
      students,
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
                role: true,
              },
            },
            notificationsSent: {
              select: {
                recipients: true,
                type: true,
                message: true,
                sentAt: true,
                studentStatus: true,
              },
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
      },
    });

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      statuses: student.statuses,
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
    // console.log("file", req.file);
    // const proposalFile = req.file;

    // if (!proposalFile) {
    //     const error = new Error('No proposal file uploaded');
    //     error.statusCode = 400;
    //     throw error;
    // }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        statuses: {
          where: {
            isCurrent: true,
          },
          take: 1,
        },
        proposals: {
          where: {
            isCurrent: true,
          },
        },
      },
    });

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }
    // Get current year
    const currentYear = new Date().getFullYear();

    // Get the latest proposal code for this year
    const latestProposal = await prisma.proposal.findFirst({
      where: {
        proposalCode: {
          startsWith: `PR-${currentYear}`,
        },
      },
      orderBy: {
        proposalCode: "desc",
      },
    });

    let nextNumber = 1;
    if (latestProposal) {
      // Extract the number from the latest proposal code and increment
      const lastNumber = parseInt(latestProposal.proposalCode.split("-")[2]);
      nextNumber = lastNumber + 1;
    }

    // Generate unique proposal code (PR-YYYY-XXXX where XXXX is padded with zeros)
    const proposalCode = `PR-${currentYear}-${String(nextNumber).padStart(
      4,
      "0"
    )}`;

    // If student has a current proposal, update it to not be current
    if (student.proposals && student.proposals.length > 0) {
      await prisma.proposal.update({
        where: { id: student.proposals[0].id },
        data: { isCurrent: false },
      });
    }

    // Create new proposal with file buffer
    const proposal = await prisma.proposal.create({
      data: {
        proposalCode,
        title,
        description,
        submissionDate: new Date(submissionDate),
        researchArea,
        // fileData: proposalFile.buffer,
        // fileName: proposalFile.originalname,
        // fileType: proposalFile.mimetype,
        isCurrent: true,

        student: {
          connect: { id: studentId },
        },
        submittedBy: {
          connect: { id: req.user.id },
        },
      },
    });

    // Update current status to not be current
    if (student.statuses[0]) {
      await prisma.studentStatus.update({
        where: { id: student.statuses[0].id },
        data: {
          isCurrent: false,
          endDate: new Date(),
        },
      });
    }

    let statusDefinition = await prisma.statusDefinition.findUnique({
      where: { name: "proposal received" },
    });

    if (!statusDefinition) {
      statusDefinition = await prisma.statusDefinition.create({
        data: {
          name: "Proposal Received",
          description: "Proposal has been received by the faculty member",
        },
      });
    }

    // Create new status record for proposal submission
    await prisma.studentStatus.create({
      data: {
        student: {
          connect: { id: studentId },
        },
        definition: {
          connect: { id: statusDefinition.id },
        },
        updatedBy: {
          connect: { id: req.user.id },
        },
        startDate: new Date(),
        isCurrent: true,
      },
    });

    // Create initial proposal status
    await prisma.proposalStatus.create({
      data: {
        proposal: {
          connect: { id: proposal.id },
        },
        definition: {
          connect: { id: statusDefinition.id },
        },
        startDate: new Date(),
        isActive: true,
        isCurrent: true,
      },
    });

    res.status(201).json({
      message: "Proposal submitted successfully",
      proposal: {
        id: proposal.id,
        title: proposal.title,
        submissionDate: proposal.submissionDate,
        fileName: proposal.fileName,
        status: proposal.status,
      },
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
        studentId: studentId,
      },
      include: {
        student: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        reviewGrades: true,
        defenseGrades: true,
        defenses: {
          include: {
            panelists: true,
          },
        },
        reviewers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        panelists: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        statuses: {
          include: {
            definition: true,
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
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
        school: true,
      },
    });

    if (!faculty || !faculty.campusId) {
      const error = new Error(
        "Faculty member not found or not associated with a campus"
      );
      error.statusCode = 404;
      throw error;
    }

    // Get all proposals from students in the same campus
    const proposals = await prisma.proposal.findMany({
      where: {
        student: {
          AND: [{ campusId: faculty.campusId }, { schoolId: faculty.schoolId }],
        },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewGrades: {
          select: {
            id: true,
            verdict: true,
            feedback: true,
            createdAt: true,
            gradedBy: {
              select: {
                id: true,
                name: true,
              },
            },
            submittedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
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
                name: true,
              },
            },
            submittedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        panelists: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        defenses: true,

        statuses: {
          include: {
            definition: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
    });

    res.status(200).json({
      message: "Proposals retrieved successfully",
      proposals: proposals,
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
            role: true,
          },
        },
        reviewers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        panelists: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        defenseGrades: true,
        reviewGrades: true,
        statuses: {
          include: {
            definition: true,
          },
        },
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
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

/** PROPOSAL MANAGEMENT CONTROLLERS */

// Grade proposal
export const gradeProposal = async (req, res, next) => {
  try {
    const { studentId, proposalId } = req.params;
    const { grade, feedback } = req.body;

    const proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        studentId: studentId,
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Create grade for proposal
    const gradedProposal = await prisma.proposalGrade.create({
      data: {
        grade,
        feedback,
        proposal: {
          connect: { id: proposalId },
        },
        gradedBy: {
          connect: { id: req.user.id },
        },
      },
    });

    // Update student status
    await prisma.studentStatus.create({
      data: {
        student: {
          connect: { id: studentId },
        },
        definition: {
          connect: { code: "PROPOSAL_GRADED" },
        },
        updatedBy: {
          connect: { id: req.user.id },
        },
      },
    });

    res.status(200).json({
      message: "Proposal graded successfully",
      grade: gradedProposal,
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
      const error = new Error("Invalid input data");
      error.statusCode = 400;
      throw error;
    }

    // Get proposal with student details and current status
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        student: true,
        reviewers: true,
        statuses: {
          include: {
            definition: true,
          },
        },
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    if (!proposal.student) {
      const error = new Error("Student not found for this proposal");
      error.statusCode = 404;
      throw error;
    }

    // Get user's campus
    const faculty = await prisma.facultyMember.findUnique({
      where: { userId: req.user.id },
      include: {
        campus: true,
      },
    });

    if (!faculty || !faculty.campus) {
      const error = new Error("Faculty member or campus not found");
      error.statusCode = 404;
      throw error;
    }

    // Process each reviewer - could be staff member ID or existing reviewer data (object)
    const reviewerPromises = reviewers.map(async (reviewerData) => {
      // Check if this is a staff member ID (string) or existing reviewer data (object)
      if (typeof reviewerData === 'string') {
        // This is a staff member ID
        const staffMember = await prisma.staffMember.findUnique({
          where: { id: reviewerData },
          include: {
            school: true,
            department: true,
            campus: true
          }
        });

        if (!staffMember) {
          throw new Error(`Staff member with ID ${reviewerData} not found`);
        }

        // Check if staff member already has a reviewer role
        if (staffMember.reviewerId) {
          // Staff member already has a reviewer role, use existing reviewer
          const existingReviewer = await prisma.reviewer.findUnique({
            where: { id: staffMember.reviewerId }
          });
          
          if (!existingReviewer) {
            throw new Error(`Reviewer for staff member ${staffMember.name} not found`);
          }
          
          return existingReviewer;
        } else {
          // Staff member doesn't have a reviewer role, create one
          // Create the reviewer directly (no user account needed)
          const newReviewer = await prisma.reviewer.create({
            data: {
              name: staffMember.name,
              email: staffMember.email,
              primaryPhone: staffMember.phone,
              institution: staffMember.isExternal ? staffMember.externalInstitution : 'Uganda Management Institute',
              specialization: staffMember.specialization || 'Not specified',
              campus: staffMember.campusId ? { connect: { id: staffMember.campusId } } : undefined
            }
          });

          // Connect the reviewer to the staff member
          await prisma.staffMember.update({
            where: { id: staffMember.id },
            data: { reviewerId: newReviewer.id }
          });

          // Send email notification to the new reviewer
          // try {
          //   const reviewerEmailTemplate = `
          //     <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          //       <h2 style="color: #2563eb;">Welcome to UMI Research Management System</h2>
          //       <p>Dear ${staffMember.name},</p>
          //       <p>You have been assigned as a reviewer in the UMI Research Management System.</p>
          //       <p>You will be notified when proposals are assigned to you for review.</p>
          //       <p>Best regards,<br>UMI Research Management Team</p>
          //     </div>
          //   `;

          //   await emailService.sendEmail({
          //     to: staffMember.email,
          //     subject: 'Reviewer Assignment - UMI Research Management System',
          //     htmlContent: reviewerEmailTemplate
          //   });

          //   console.log(`Email sent to new reviewer: ${staffMember.email}`);
          // } catch (emailError) {
          //   console.error('Error sending reviewer assignment email:', emailError);
          //   // Don't fail the request if email fails
          // }

          return newReviewer;
        }
      } else {
        // This is existing reviewer data (name, email, etc.)
        const { name, email } = reviewerData;
        
        if (!name || !email) {
          throw new Error("Each reviewer must have name and email");
        }

        // Use upsert to create or update reviewer
        const reviewer = await prisma.reviewer.upsert({
          where: { email },
          update: {
            name,
            proposals: {
              connect: { id: proposalId },
            },
            campus: {
              connect: { id: faculty.campusId },
            },
          },
          create: {
            email,
            name,
            proposals: {
              connect: { id: proposalId },
            },
            campus: {
              connect: { id: faculty.campusId },
            },
          },
        });
        return reviewer;
      }
    });

    const createdReviewers = await Promise.all(reviewerPromises);

    // Update proposal with reviewer connections
    await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        reviewers: {
          connect: createdReviewers.map((r) => ({ id: r.id })),
        },
      },
    });

    // Check if we need to update the proposal status
    const needsStatusUpdate =
      proposal.statuses.length === 0 ||
      !proposal.statuses.some(
        (status) =>
          status.definition.name.toLowerCase() === "proposal in review"
      );

    if (needsStatusUpdate) {
      // Find the status definition for 'proposal in review'
      const statusDefinition = await prisma.statusDefinition.findUnique({
        where: { name: "proposal in review" },
      });

      if (!statusDefinition) {
        const error = new Error("Status definition not found");
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
            endDate: currentDate,
          },
        });
      }

      // Update previous student statuses to not current and set end date
      await prisma.studentStatus.updateMany({
        where: {
          studentId: proposal.student.id,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          endDate: currentDate,
        },
      });

      // Create new proposal status
      await prisma.proposalStatus.create({
        data: {
          proposal: {
            connect: { id: proposalId },
          },
          definition: {
            connect: { id: statusDefinition.id },
          },
          startDate: new Date(),
          isActive: true,
          isCurrent: true,
        },
      });

      // Update student status using the student from the proposal
      await prisma.studentStatus.create({
        data: {
          student: {
            connect: { id: proposal.student.id },
          },
          definition: {
            connect: { id: statusDefinition.id },
          },
          updatedBy: {
            connect: { id: req.user.id },
          },
          startDate: new Date(),
          isCurrent: true,
        },
      });
    }

    res.status(200).json({
      message: "Reviewers added successfully",
      reviewers: createdReviewers,
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
        userId: req.user.id,
      },
      select: {
        campusId: true,
      },
    });

    if (!facultyMember || !facultyMember.campusId) {
      const error = new Error("Faculty member campus not found");
      error.statusCode = 400;
      throw error;
    }

    // Get all reviewers for the faculty member's campus
    const reviewers = await prisma.reviewer.findMany({
      where: {
        campusId: facultyMember.campusId,
      },
      include: {
        proposals: {
          include: {
            student: true,
            statuses: {
              include: {
                definition: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(reviewers);

    res.status(200).json({
      message: "Reviewers retrieved successfully",
      reviewers: reviewers,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/** to be deleted */
// Add reviewer mark to proposal
export const addReviewerMark = async (req, res, next) => {
  try {
    const { proposalId, reviewerId } = req.params;
    const { verdict, feedback } = req.body;

    // Get the currently logged-in faculty user
    const submittedById = req.user.id;

    // Validate input
    if (!proposalId || !reviewerId || verdict === undefined || !feedback) {
      const error = new Error("Invalid input data");
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
            definition: true,
          },
        },
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if reviewer is assigned to proposal
    const isReviewerAssigned = proposal.reviewers.some(
      (reviewer) => reviewer.id === reviewerId
    );

    if (!isReviewerAssigned) {
      const error = new Error("Reviewer is not assigned to this proposal");
      error.statusCode = 400;
      throw error;
    }

    let updatedOrNewGrade;
    // Create or update the review grade
    const existingGrade = proposal.reviewGrades.find(
      (grade) => grade.gradedById === reviewerId
    );

    if (existingGrade) {
      // Update existing grade
      updatedOrNewGrade = await prisma.proposalReviewGrade.update({
        where: { id: existingGrade.id },
        data: {
          verdict,
          feedback,
          updatedBy: { connect: { id: submittedById } },
        },
      });
    } else {
      // Create new grade
      updatedOrNewGrade = await prisma.proposalReviewGrade.create({
        data: {
          proposal: { connect: { id: proposalId } },
          gradedBy: { connect: { id: reviewerId } },
          verdict,
          feedback,
          submittedBy: { connect: { id: submittedById } },
        },
      });
    }

    // Get updated proposal data
    const updatedProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        reviewGrades: true,
        reviewers: true,
        student: true,
        statuses: {
          include: {
            definition: true,
          },
        },
      },
    });

    // Check if current status is already "Proposal Review Finished"
    const currentStatus = updatedProposal.statuses.find(
      (status) => status.isCurrent
    );
    const isAlreadyFinished =
      currentStatus?.definition?.name === "proposal review finished" ||
      currentStatus?.definition?.name === "passed-proposal review finished" ||
      currentStatus?.definition?.name === "failed-proposal review finished";

    // Only update status if not already finished and all reviewers have submitted grades
    if (
      !isAlreadyFinished &&
      updatedProposal.reviewGrades.length === updatedProposal.reviewers.length
    ) {
      // Update proposal status
      await prisma.proposalStatus.updateMany({
        where: {
          proposalId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          endDate: new Date(),
        },
      });

      // Determine the status based on verdict
      let statusName = "proposal review finished";
      if (verdict.toLowerCase().includes("pass")) {
        statusName = "passed-proposal review finished";
      } else if (verdict.toLowerCase().includes("fail")) {
        statusName = "failed-proposal review finished";
      }

      // Get the status definition ID for the appropriate status
      const proposalReviewFinishedStatus =
        await prisma.statusDefinition.findFirst({
          where: {
            name: statusName,
          },
        });

      if (!proposalReviewFinishedStatus) {
        throw new Error("Status definition not found");
      }

      await prisma.proposalStatus.create({
        data: {
          proposal: { connect: { id: proposalId } },
          definition: { connect: { id: proposalReviewFinishedStatus.id } },
          isCurrent: true,
          startDate: new Date(),
        },
      });

      // Update student status if proposal passed review
      if (updatedProposal.student) {
        await prisma.studentStatus.updateMany({
          where: {
            studentId: updatedProposal.student.id,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
            endDate: new Date(),
          },
        });

        await prisma.studentStatus.create({
          data: {
            student: { connect: { id: updatedProposal.student.id } },
            definition: { connect: { id: proposalReviewFinishedStatus.id } },
            isCurrent: true,
            startDate: new Date(),
            updatedBy: { connect: { id: submittedById } },
          },
        });
      }
    }

    res.status(existingGrade ? 200 : 201).json({
      message: existingGrade
        ? "Reviewer mark updated successfully"
        : "Reviewer mark added successfully",
      grade: updatedOrNewGrade,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Delete reviewer from proposal
export const deleteReviewer = async (req, res, next) => {
  try {
    const { proposalId, reviewerId } = req.params;

    // Check if proposal exists
    const proposal = await prisma.proposal.findUnique({
      where: {
        id: proposalId,
      },
      include: {
        reviewers: true,
        reviewGrades: true,
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if reviewer is assigned to proposal
    const isReviewerAssigned = proposal.reviewers.some(
      (reviewer) => reviewer.id === reviewerId
    );

    if (!isReviewerAssigned) {
      const error = new Error("Reviewer is not assigned to this proposal");
      error.statusCode = 400;
      throw error;
    }

    // Check if reviewer has submitted any grades
    const hasGrades = proposal.reviewGrades.some(
      (grade) => grade.reviewerId === reviewerId
    );

    if (hasGrades) {
      const error = new Error(
        "Cannot remove reviewer who has already submitted grades"
      );
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
                id: reviewerId,
              },
            },
          },
          {
            id: {
              not: proposalId,
            },
          },
        ],
      },
    });

    // Delete reviewer from proposal
    await prisma.proposal.update({
      where: {
        id: proposalId,
      },
      data: {
        reviewers: {
          disconnect: {
            id: reviewerId,
          },
        },
      },
    });

    // If reviewer has no other proposals, delete the reviewer
    if (otherProposals.length === 0) {
      await prisma.reviewer.delete({
        where: {
          id: reviewerId,
        },
      });
    }

    res.status(200).json({
      message: "Reviewer removed successfully",
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
        userId: req.user.id,
      },
      select: {
        campusId: true,
      },
    });

    if (!facultyMember || !facultyMember.campusId) {
      const error = new Error("Faculty member campus not found");
      error.statusCode = 400;
      throw error;
    }

    // Get all panelists for the faculty member's campus
    const panelists = await prisma.panelist.findMany({
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json({
      message: "Panelists retrieved successfully",
      panelists: panelists,
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
      const error = new Error("Invalid input data");
      error.statusCode = 400;
      throw error;
    }

    console.log(panelists);

    // Validate panelist objects
    for (const panelist of panelists) {
      if (!panelist.name || !panelist.email) {
        const error = new Error("Each panelist must have name and email");
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
            isCurrent: true,
          },
          include: {
            definition: true,
          },
        },
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    if (!proposal.student) {
      const error = new Error("Student not found for this proposal");
      error.statusCode = 404;
      throw error;
    }

    // Get user's campus
    const faculty = await prisma.facultyMember.findUnique({
      where: { userId: req.user.id },
      select: { campusId: true },
    });

    if (!faculty || !faculty.campusId) {
      const error = new Error("Faculty campus not found");
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
          campusId: faculty.campusId,
        },
      });

      // Create panelist if doesn't exist
      if (!existingPanelist) {
        existingPanelist = await prisma.panelist.create({
          data: {
            name: panelist.name,
            email: panelist.email,
            campus: {
              connect: { id: faculty.campusId },
            },
          },
        });
      }

      // Check if panelist is already assigned to this proposal
      const alreadyAssigned = proposal.panelists.some(
        (p) => p.id === existingPanelist.id
      );
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
            connect: panelistsToAdd.map((id) => ({ id })),
          },
        },
      });
    }

    // Get updated proposal with panelists
    const updatedProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        panelists: true,
      },
    });

    res.status(200).json({
      message: "Panelists added successfully",
      panelists: updatedProposal.panelists,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/** to be deleted */
export const addPanelistMark = async (req, res, next) => {
  try {
    const { proposalId, panelistId } = req.params;
    const { grade, feedback } = req.body;

    // Validate input
    if (
      !proposalId ||
      !panelistId ||
      grade === undefined ||
      feedback === undefined
    ) {
      const error = new Error("Invalid input data");
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
            definition: true,
          },
        },
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if panelist is assigned to proposal
    const isPanelistAssigned = proposal.panelists.some(
      (panelist) => panelist.id === panelistId
    );

    if (!isPanelistAssigned) {
      const error = new Error("Panelist is not assigned to this proposal");
      error.statusCode = 400;
      throw error;
    }

    let resultingGrade;

    // Create or update the defense grade
    const existingGrade = proposal.defenseGrades.find(
      (grade) => grade.gradedById === panelistId
    );

    if (existingGrade) {
      // Update existing grade
      resultingGrade = await prisma.proposalDefenseGrade.update({
        where: { id: existingGrade.id },
        data: { grade, feedback, updatedBy: { connect: { id: req.user.id } } },
      });
    } else {
      // Create new grade
      resultingGrade = await prisma.proposalDefenseGrade.create({
        data: {
          proposal: { connect: { id: proposalId } },
          gradedBy: { connect: { id: panelistId } },
          grade,
          feedback,
          submittedBy: { connect: { id: req.user.id } },
        },
      });
    }

    // Calculate average if there are multiple grades
    const updatedProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { defenseGrades: true },
    });

    if (updatedProposal.defenseGrades.length > 1) {
      const totalGrade = updatedProposal.defenseGrades.reduce(
        (sum, grade) => sum + grade.grade,
        0
      );
      const averageGrade = totalGrade / updatedProposal.defenseGrades.length;

      // Update proposal with average defense mark
      await prisma.proposal.update({
        where: { id: proposalId },
        data: {
          averageDefenseMark: averageGrade,
        },
      });

      // Update proposal status
      await prisma.proposalStatus.updateMany({
        where: {
          proposalId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          endDate: new Date(),
        },
      });

      // Get status definitions based on grade
      const passedStatus = await prisma.statusDefinition.findFirst({
        where: { name: "passed-proposal graded" },
      });

      const failedStatus = await prisma.statusDefinition.findFirst({
        where: { name: "failed-proposal graded" },
      });

      if (!passedStatus || !failedStatus) {
        throw new Error("Status definitions not found");
      }

      // Create new proposal status
      await prisma.proposalStatus.create({
        data: {
          proposal: { connect: { id: proposalId } },
          definition: {
            connect: {
              id: averageGrade >= 60 ? passedStatus.id : failedStatus.id,
            },
          },
          isCurrent: true,
          startDate: new Date(),
        },
      });

      // Update student status if student exists
      if (proposal.student) {
        // Set current student status to not current
        await prisma.studentStatus.updateMany({
          where: {
            studentId: proposal.student.id,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
            endDate: new Date(),
          },
        });

        // Create new student status
        await prisma.studentStatus.create({
          data: {
            student: { connect: { id: proposal.student.id } },
            definition: {
              connect: {
                id: averageGrade >= 60 ? passedStatus.id : failedStatus.id,
              },
            },
            isCurrent: true,
            startDate: new Date(),
            updatedBy: { connect: { id: req.user.id } },
          },
        });
      }
    }

    res.status(existingGrade ? 200 : 201).json({
      message: existingGrade
        ? "Panelist mark updated successfully"
        : "Panelist mark added successfully",
      grade: resultingGrade,
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
        id: proposalId,
      },
      include: {
        panelists: true,
        defenseGrades: true,
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if panelist is assigned to proposal
    const isPanelistAssigned = proposal.panelists.some(
      (panelist) => panelist.id === panelistId
    );

    if (!isPanelistAssigned) {
      const error = new Error("Panelist is not assigned to this proposal");
      error.statusCode = 400;
      throw error;
    }

    // Check if panelist has submitted any grades
    const hasGrades = proposal.defenseGrades.some(
      (grade) => grade.panelistId === panelistId
    );

    if (hasGrades) {
      const error = new Error(
        "Cannot remove panelist who has already submitted grades"
      );
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
                id: panelistId,
              },
            },
          },
          {
            id: {
              not: proposalId,
            },
          },
        ],
      },
    });

    // Delete panelist from proposal
    await prisma.proposal.update({
      where: {
        id: proposalId,
      },
      data: {
        panelists: {
          disconnect: {
            id: panelistId,
          },
        },
      },
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
          id: panelistId,
        },
      });
    }

    res.status(200).json({
      message: "Panelist removed successfully",
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Get all faculty members who can serve as chairpersons
 * @route GET /api/v1/faculty/chairpersons
 * @access Private
 */
export const getChairpersons = async (req, res, next) => {
  try {
    // Get all faculty members who can serve as chairpersons
    const chairpersons = await prisma.facultyMember.findMany({
      where: {
        facultyType: "Research Committee Chairperson",
      },
    });

    res.status(200).json({
      message: "Chairpersons retrieved successfully",
      chairpersons,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Create a new chairperson
 * @route POST /api/v1/faculty/chairperson
 * @access Private
 */
export const createChairperson = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      const error = new Error("Name and email are required");
      error.statusCode = 400;
      throw error;
    }

    // Check if faculty member with this email already exists
    const existingFaculty = await prisma.facultyMember.findUnique({
      where: { email },
    });

    if (existingFaculty) {
      return res.status(200).json({
        message: "Faculty member already exists",
        chairperson: existingFaculty,
      });
    }

    // Create new faculty member who can serve as chairperson
    const chairperson = await prisma.facultyMember.create({
      data: {
        name,
        email,
        isActive: true,
      },
    });

    res.status(201).json({
      message: "Chairperson created successfully",
      chairperson,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Get all external persons (acting chairpersons, minutes secretaries, etc.)
 * @route GET /api/v1/faculty/external-persons
 * @access Private
 */
export const getExternalPersons = async (req, res, next) => {
  try {
    // Get all external persons
    const externalPersons = await prisma.externalPerson.findMany({
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json({
      message: "External persons retrieved successfully",
      externalPersons,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Get external persons by role
 * @route GET /api/v1/faculty/external-persons/:role
 * @access Private
 */
export const getExternalPersonsByRole = async (req, res, next) => {
  try {
    const { role } = req.params;

    if (!role) {
      const error = new Error("Role parameter is required");
      error.statusCode = 400;
      throw error;
    }

    // Get external persons by role
    const externalPersons = await prisma.externalPerson.findMany({
      where: {
        role,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json({
      message: `${role} retrieved successfully`,
      externalPersons,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Create a new external person (acting chairperson, minutes secretary, etc.)
 * @route POST /api/v1/faculty/external-person
 * @access Private
 */
export const createExternalPerson = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      const error = new Error("Name, email, and role are required");
      error.statusCode = 400;
      throw error;
    }

    // Check if external person with this email already exists
    const existingPerson = await prisma.externalPerson.findFirst({
      where: {
        email,
        role,
      },
    });

    if (existingPerson) {
      return res.status(200).json({
        message: "External person already exists",
        externalPerson: existingPerson,
      });
    }

    // Create new external person
    const externalPerson = await prisma.externalPerson.create({
      data: {
        name,
        email,
        role,
        // isActive: true
      },
    });

    res.status(201).json({
      message: "External person created successfully",
      externalPerson,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Update an external person
 * @route PUT /api/v1/faculty/external-person/:id
 * @access Private
 */
export const updateExternalPerson = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;

    if (!id) {
      const error = new Error("External person ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Check if external person exists
    const existingPerson = await prisma.externalPerson.findUnique({
      where: { id },
    });

    if (!existingPerson) {
      const error = new Error("External person not found");
      error.statusCode = 404;
      throw error;
    }

    // Update external person
    const updatedPerson = await prisma.externalPerson.update({
      where: { id },
      data: {
        name: name || existingPerson.name,
        email: email || existingPerson.email,
        role: role || existingPerson.role,
        isActive: isActive !== undefined ? isActive : existingPerson.isActive,
      },
    });

    res.status(200).json({
      message: "External person updated successfully",
      externalPerson: updatedPerson,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Delete an external person
 * @route DELETE /api/v1/faculty/external-person/:id
 * @access Private
 */
export const deleteExternalPerson = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      const error = new Error("External person ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Check if external person exists
    const existingPerson = await prisma.externalPerson.findUnique({
      where: { id },
    });

    if (!existingPerson) {
      const error = new Error("External person not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if the external person is associated with any proposals
    const associatedProposals = await prisma.proposal.findMany({
      where: {
        OR: [{ actingChairpersonId: id }, { minutesSecretaryId: id }],
      },
    });

    if (associatedProposals.length > 0) {
      // Instead of deleting, mark as inactive
      const updatedPerson = await prisma.externalPerson.update({
        where: { id },
        data: { isActive: false },
      });

      return res.status(200).json({
        message: "External person is in use and has been marked as inactive",
        externalPerson: updatedPerson,
      });
    }

    // Delete the external person if not associated with any proposals
    await prisma.externalPerson.delete({
      where: { id },
    });

    res.status(200).json({
      message: "External person deleted successfully",
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/** to be deleted */
// Add defense date to proposal
export const addDefenseDate = async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const { defenseDate, type } = req.body;

    // Validate input
    if (!proposalId || !defenseDate || !type) {
      const error = new Error("Invalid input data");
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
            isCurrent: true,
          },
          include: {
            definition: true,
          },
        },
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // If type is reschedule, just update the defense date
    if (type === "reschedule") {
      const updatedProposal = await prisma.proposal.update({
        where: { id: proposalId },
        data: {
          defenseDate: new Date(defenseDate),
        },
      });

      return res.status(200).json({
        message: "Defense date rescheduled successfully",
        proposal: updatedProposal,
      });
    }

    // For new defense date scheduling, continue with status updates
    // Update current proposal status to not current
    await prisma.proposalStatus.updateMany({
      where: {
        proposalId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        endDate: new Date(),
      },
    });

    // Get the status definition for "waiting for proposal defense"
    const waitingForDefenseStatus = await prisma.statusDefinition.findFirst({
      where: {
        name: "waiting for proposal defense",
      },
    });

    if (!waitingForDefenseStatus) {
      throw new Error("Status definition not found");
    }

    // Create new proposal status
    await prisma.proposalStatus.create({
      data: {
        proposal: { connect: { id: proposalId } },
        definition: { connect: { id: waitingForDefenseStatus.id } },
        isCurrent: true,
        startDate: new Date(),
      },
    });

    // Update student status
    if (proposal.student) {
      // Set current student status to not current
      await prisma.studentStatus.updateMany({
        where: {
          studentId: proposal.student.id,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          endDate: new Date(),
        },
      });

      // Create new student status
      await prisma.studentStatus.create({
        data: {
          student: { connect: { id: proposal.student.id } },
          definition: { connect: { id: waitingForDefenseStatus.id } },
          isCurrent: true,
          startDate: new Date(),
          updatedBy: { connect: { id: req.user.id } },
        },
      });
    }

    // Update proposal with defense date
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        defenseDate: new Date(defenseDate),
      },
    });

    res.status(200).json({
      message: "Defense date added successfully",
      proposal: updatedProposal,
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
      const error = new Error("Invalid input data");
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
            definition: true,
          },
        },
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Get status definition for compliance report submitted
    const complianceReportSubmittedStatus =
      await prisma.statusDefinition.findFirst({
        where: { name: "compliance report submitted" },
      });

    if (!complianceReportSubmittedStatus) {
      throw new Error("Status definition not found");
    }

    // Update current status to not current
    await prisma.proposalStatus.updateMany({
      where: {
        proposalId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        endDate: new Date(),
      },
    });

    // Create new status for compliance report submitted
    await prisma.proposalStatus.create({
      data: {
        proposal: { connect: { id: proposalId } },
        definition: { connect: { id: complianceReportSubmittedStatus.id } },
        isCurrent: true,
        startDate: new Date(),
      },
    });

    // Update student status if student exists
    if (proposal.student) {
      // Set current student status to not current
      await prisma.studentStatus.updateMany({
        where: {
          studentId: proposal.student.id,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          endDate: new Date(),
        },
      });

      // Create new student status
      await prisma.studentStatus.create({
        data: {
          student: { connect: { id: proposal.student.id } },
          definition: { connect: { id: complianceReportSubmittedStatus.id } },
          isCurrent: true,
          startDate: new Date(),
          updatedBy: { connect: { id: req.user.id } },
        },
      });
    }

    // Update proposal with compliance report date
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        complianceReportDate: new Date(complianceReportDate),
      },
    });

    res.status(200).json({
      message: "Compliance report date added successfully",
      proposal: updatedProposal,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
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
      const error = new Error("Field letter date is required");
      error.statusCode = 400;
      throw error;
    }

    // Validate date format
    const dateObj = new Date(fieldLetterDate);
    if (isNaN(dateObj.getTime())) {
      const error = new Error("Invalid date format");
      error.statusCode = 400;
      throw error;
    }

    // Check if proposal exists
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        student: true,
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Get letter to field status definition
    const letterToFieldStatus = await prisma.statusDefinition.findFirst({
      where: { name: "letter to field issued" },
    });

    if (!letterToFieldStatus) {
      const error = new Error("Letter to field status definition not found");
      error.statusCode = 404;
      throw error;
    }

    // Get fieldwork status definition
    const fieldworkStatus = await prisma.statusDefinition.findFirst({
      where: { name: "fieldwork" },
    });

    if (!fieldworkStatus) {
      const error = new Error("Fieldwork status definition not found");
      error.statusCode = 404;
      throw error;
    }

    // Update student status
    await prisma.studentStatus.updateMany({
      where: {
        studentId: proposal.student.id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        endDate: new Date(),
      },
    });

    // Create letter to field status
    await prisma.studentStatus.create({
      data: {
        student: { connect: { id: proposal.student.id } },
        definition: { connect: { id: letterToFieldStatus.id } },
        isCurrent: false,
        startDate: new Date(),
        endDate: new Date(),
        updatedBy: { connect: { id: req.user.id } },
      },
    });

    // Create fieldwork status
    await prisma.studentStatus.create({
      data: {
        student: { connect: { id: proposal.student.id } },
        definition: { connect: { id: fieldworkStatus.id } },
        isCurrent: true,
        startDate: new Date(),
        updatedBy: { connect: { id: req.user.id } },
      },
    });

    // Update proposal statuses
    await prisma.proposalStatus.updateMany({
      where: {
        proposalId: proposalId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        endDate: new Date(),
      },
    });

    await prisma.proposalStatus.create({
      data: {
        proposal: { connect: { id: proposalId } },
        definition: { connect: { id: letterToFieldStatus.id } },
        isCurrent: true,
        startDate: new Date(),
        endDate: new Date(),
      },
    });

    // Update the field letter date
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        fieldLetterDate: new Date(fieldLetterDate),
      },
    });

    res.status(200).json({
      message: "Field letter date updated successfully",
      proposal: updatedProposal,
    });
  } catch (error) {
    console.error("Error in updateFieldLetterDate:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Update Ethics Committee Date for a proposal
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */

export const updateEthicsCommitteeDate = async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const { ethicsCommitteeDate } = req.body;

    if (!ethicsCommitteeDate) {
      const error = new Error("ETHICS COMMITTEE DATE IS REQUIRED");
      error.statusCode = 400;
      throw error;
    }

    // Validate date format
    const dateObj = new Date(ethicsCommitteeDate);
    if (isNaN(dateObj.getTime())) {
      const error = new Error("Invalid date format");
      error.statusCode = 400;
      throw error;
    }
    // Check if proposal exists
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        student: true,
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Get letter to field status definition
    const ethicsCommitteeStatus = await prisma.statusDefinition.findFirst({
      where: { name: "letter to ethics committee issued" },
    });

    if (!ethicsCommitteeStatus) {
      throw new Error("Ethics Committee Status not found");
    }

    // Update student status
    await prisma.studentStatus.updateMany({
      where: {
        studentId: proposal.student.id,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        endDate: new Date(),
      },
    });

    // Create letter to ethics committee status
    await prisma.studentStatus.create({
      data: {
        student: { connect: { id: proposal.student.id } },
        definition: { connect: { id: ethicsCommitteeStatus.id } },
        isCurrent: true,
        startDate: new Date(),

        updatedBy: { connect: { id: req.user.id } },
      },
    });

    // Update proposal statuses
    await prisma.proposalStatus.updateMany({
      where: {
        proposalId: proposalId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        endDate: new Date(),
      },
    });

    // Create the status for Ethics Committee
    await prisma.proposalStatus.create({
      data: {
        proposal: { connect: { id: proposalId } },
        definition: { connect: { id: ethicsCommitteeStatus.id } },
        isCurrent: true,
        startDate: new Date(),
      },
    });

    // Update the Ethics Committee date
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        ethicsCommitteeDate: new Date(ethicsCommitteeDate),
      },
    });
    res.status(200).json({
      message: "ETHICS COMMITTEE DATE ISSUED",
      proposal: updatedProposal,
    });
  } catch (error) {
    console.error("Error in updateEthicsCommitteeDate:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Generate and record a defense report
 * @route POST /api/v1/faculty/generate-defense-report/:proposalId
 * @access Private (School Admin)
 */
export const generateDefenseReport = async (req, res) => {
  try {
    // Validate input fields
    const { proposalId } = req.params;
    const {
      title,
      studentName,
      regNo,
      topic,
      supervisors,
      verdict,
      reportDate,
      department,
    } = req.body;
    const reportFile = req.file;

    if (
      !proposalId ||
      !title ||
      !studentName ||
      !regNo ||
      !topic ||
      !verdict ||
      !reportDate ||
      !reportFile
    ) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // Check if proposal exists
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      return res.status(404).json({
        message: "Proposal not found",
      });
    }

    // Sanitize student name for filename
    const sanitizedName = studentName
      .replace(/[^a-zA-Z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .toLowerCase(); // Convert to lowercase

    // Generate filename using sanitized student name
    const filename = `Proposal_Defense_Report_${sanitizedName}.docx`;

    // Create defense report record with file data
    const defenseReport = await prisma.proposalDefenseReport.create({
      data: {
        type: "defense_report",
        title,
        status: "completed",
        studentName,
        regNo,
        topic,
        supervisors: supervisors || "",
        verdict,
        reportDate,
        department: department || "COLLEGE OF HUMANITIES AND SOCIAL SCIENCES",
        fileData: reportFile.buffer, // Store the file data as BLOB
        fileName: filename, // Use the sanitized filename
        fileType: reportFile.mimetype,
        proposal: { connect: { id: proposalId } },
        generatedBy: { connect: { id: req.user.id } },
      },
    });

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId: req.user.id,
        action: `Generated defense report for ${studentName} (${regNo})`,
        entityType: "DefenseReport",
        entityId: defenseReport.id,
        details: `Report type: Defense Report, Verdict: ${verdict}`,
      },
    });

    res.status(201).json({
      message: "Defense report generated and saved successfully",
      defenseReport: {
        id: defenseReport.id,
        title: defenseReport.title,
        downloadUrl: defenseReport.downloadUrl,
        generatedAt: defenseReport.generatedAt,
        status: defenseReport.status,
        studentName: defenseReport.studentName,
        regNo: defenseReport.regNo,
        topic: defenseReport.topic,
        verdict: defenseReport.verdict,
        fileName: defenseReport.fileName, // Include filename in response
      },
    });
  } catch (error) {
    console.error("Error generating defense report:", error);
    res.status(500).json({
      message: "Error generating defense report",
      error: error.message,
    });
  }
};

/**
 * Get defense reports for a proposal
 * @route GET /api/v1/faculty/proposal/:proposalId/defense-reports
 * @access Private (School Admin)
 */
export const getProposalDefenseReports = async (req, res) => {
  try {
    const { proposalId } = req.params;

    // Check if proposal exists
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
    }

    // Get defense reports for the proposal
    const defenseReports = await prisma.proposalDefenseReport.findMany({
      where: { proposalId },
      orderBy: { generatedAt: "desc" },
      include: {
        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Proposal defense reports retrieved successfully",
      defenseReports,
    });
  } catch (error) {
    console.error("Error in getProposalDefenseReports:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Download a defense report
 * @route GET /api/v1/faculty/defense-reports/:reportId/download
 * @access Private (School Admin)
 */
export const downloadDefenseReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    // Get the defense report with file data
    const report = await prisma.proposalDefenseReport.findUnique({
      where: { id: reportId },
      select: {
        fileData: true,
        fileName: true,
        fileType: true,
      },
    });

    if (!report || !report.fileData) {
      return res.status(404).json({
        message: "Defense report not found or file data is missing",
      });
    }

    // Set response headers
    res.setHeader(
      "Content-Type",
      report.fileType ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.fileName}"`
    );

    // Send the file data
    res.send(Buffer.from(report.fileData));
  } catch (error) {
    console.error("Error downloading defense report:", error);
    res.status(500).json({
      message: "Error downloading defense report",
      error: error.message,
    });
  }
};

/** BOOK MANAGEMENT CONTROLLERS */

// Controller for getting student books
export const getStudentBooks = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      const error = new Error("Student ID is required");
      error.statusCode = 400;
      throw error;
    }

    const books = await prisma.book.findMany({
      where: { studentId },
      include: {
        statuses: {
          include: {
            definition: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
        examinerAssignments: {
          include: {
            examiner: {
              select: {
                id: true,
                name: true,
                primaryEmail: true,
                type: true,
              },
            },
          },
        },
        vivaHistory: true,
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        submissionDate: "desc",
      },
    });

    res.status(200).json({
      message: "Student books retrieved successfully",
      books,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get all books
export const getAllBooks = async (req, res, next) => {
  try {
    const books = await prisma.book.findMany({
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        statuses: {
          include: {
            definition: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        examinerAssignments: {
          include: {
            examiner: true,
          },
        },
      },
      orderBy: {
        submissionDate: "desc",
      },
    });

    res.status(200).json({
      message: "Books retrieved successfully",
      books,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

export const getBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;

    if (!bookId) {
      const error = new Error("Book ID is required");
      error.statusCode = 400;
      throw error;
    }

    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        statuses: {
          include: {
            definition: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        examinerAssignments: {
          include: {
            examiner: true,
          },
        },
      },
    });

    if (!book) {
      const error = new Error("Book not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Book retrieved successfully",
      book,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for creating a new examiner
export const createExaminer = async (req, res, next) => {
  try {
    const {
      name,
      primaryEmail,
      secondaryEmail,
      primaryPhone,
      secondaryPhone,
      institution,
      type,
    } = req.body;

    // Validate required fields
    if (!name || !primaryEmail || !institution || !type) {
      const error = new Error(
        "Name, primary email, institution, and type are required fields"
      );
      error.statusCode = 400;
      throw error;
    }

    // Check if examiner with the same primary email already exists
    const existingExaminer = await prisma.examiner.findUnique({
      where: {
        primaryEmail,
      },
    });

    if (existingExaminer) {
      const error = new Error(
        "An examiner with this primary email already exists"
      );
      error.statusCode = 409;
      throw error;
    }

    // Create new examiner
    const newExaminer = await prisma.examiner.create({
      data: {
        name,
        primaryEmail,
        secondaryEmail,
        primaryPhone,
        secondaryPhone,
        institution,
        type,
        // createdBy: { connect: { id: req.user.id } }
      },
    });

    res.status(201).json({
      message: "Examiner created successfully",
      examiner: newExaminer,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting all examiners
export const getAllExaminers = async (req, res, next) => {
  try {
    const examiners = await prisma.examiner.findMany({
      include: {
        books: {
          include: {
            examinerAssignments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      examiners,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for assigning examiners to a book
export const assignExaminersToBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const { examinerIds } = req.body;

    if (
      !bookId ||
      !examinerIds ||
      !Array.isArray(examinerIds) ||
      examinerIds.length === 0
    ) {
      const error = new Error(
        "Book ID and at least one examiner ID are required"
      );
      error.statusCode = 400;
      throw error;
    }

    // Check if book exists
    const book = await prisma.book.findUnique({
      where: {
        id: bookId,
      },
      include: {
        student: true,
        statuses: {
          where: {
            isCurrent: true,
          },
          include: {
            definition: true,
          },
        },
      },
    });

    if (!book) {
      const error = new Error("Book not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if all examiners exist
    const examiners = await prisma.examiner.findMany({
      where: {
        id: {
          in: examinerIds,
        },
      },
    });

    if (examiners.length !== examinerIds.length) {
      const error = new Error("One or more examiners not found");
      error.statusCode = 404;
      throw error;
    }

    // Find the "Under Examination" status definition
    const underExaminationStatus = await prisma.statusDefinition.findFirst({
      where: {
        name: "under examination",
      },
    });

    if (!underExaminationStatus) {
      const error = new Error("Under Examination status definition not found");
      error.statusCode = 404;
      throw error;
    }

    // Get current date for assignment tracking
    const assignmentDate = new Date();

    // Update the book with the examiner IDs
    const updatedBook = await prisma.book.update({
      where: {
        id: bookId,
      },
      data: {
        // examinerIds: examinerIds,
        examiners: {
          connect: examinerIds.map((id) => ({ id })),
        },
        // examinerAssignmentDate: assignmentDate // Add assignment date
      },
      include: {
        examiners: true,
        student: true,
      },
    });

    // Check if the book is already under examination
    const isAlreadyUnderExamination = book.statuses.some(
      (status) => status.definition.name.toLowerCase() === "under examination"
    );

    // Only update statuses if not already under examination
    if (!isAlreadyUnderExamination) {
      // Update all current book statuses to not current
      await prisma.bookStatus.updateMany({
        where: {
          bookId: bookId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          isActive: false,
          endDate: new Date(),
        },
      });

      // Create new book status "Under Examination"
      await prisma.bookStatus.create({
        data: {
          book: { connect: { id: bookId } },
          definition: { connect: { id: underExaminationStatus.id } },
          isActive: true,
          isCurrent: true,
          startDate: new Date(),
        },
      });

      // If student exists, update their status as well
      if (book.student) {
        // Check if student is already under examination
        const studentCurrentStatus = await prisma.studentStatus.findFirst({
          where: {
            studentId: book.student.id,
            isCurrent: true,
            definition: {
              name: "under examination",
            },
          },
        });

        if (!studentCurrentStatus) {
          // Update all current student statuses to not current
          await prisma.studentStatus.updateMany({
            where: {
              studentId: book.student.id,
              isCurrent: true,
            },
            data: {
              isCurrent: false,
              isActive: false,
              endDate: new Date(),
            },
          });

          // Create new student status "Under Examination"
          await prisma.studentStatus.create({
            data: {
              student: { connect: { id: book.student.id } },
              definition: { connect: { id: underExaminationStatus.id } },
              isActive: true,
              startDate: new Date(),
              isCurrent: true,
              updatedBy: { connect: { id: req.user.id } },
            },
          });
        }
      }
    }

    // Check if there's an existing internal examiner assignment
    const existingAssignment = await prisma.examinerBookAssignment.findFirst({
      where: {
        examiner: { type: "Internal" },
        bookId,
        isCurrent: true,
      },
    });

    // Create assignments for each examiner
    for (const examinerId of examinerIds) {
      if (existingAssignment) {
        // Deactivate existing external examiner assignment
        await prisma.examinerBookAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            isCurrent: false,
          },
        });

        // Create new resubmission assignment
        await prisma.examinerBookAssignment.create({
          data: {
            examiner: { connect: { id: examinerId } },
            book: { connect: { id: bookId } },
            assignedAt: assignmentDate,
            submissionType: "Resubmission",
            status: "Pending",
            isCurrent: true,
          },
        });
      } else {
        // Create new normal assignment
        await prisma.examinerBookAssignment.create({
          data: {
            examiner: { connect: { id: examinerId } },
            book: { connect: { id: bookId } },
            assignedAt: assignmentDate,
            submissionType: "Normal",
            status: "Pending",
            isCurrent: true,
          },
        });
      }
    }

    const statusMessage = isAlreadyUnderExamination
      ? "Examiners assigned to book successfully (status already Under Examination)"
      : "Examiners assigned to book successfully and status updated to Under Examination";

    res.status(200).json({
      message: statusMessage,
      book: updatedBook,
      assignmentDate: assignmentDate,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting a single examiner by ID
export const getExaminer = async (req, res, next) => {
  try {
    const { examinerId } = req.params;

    if (!examinerId) {
      const error = new Error("Examiner ID is required");
      error.statusCode = 400;
      throw error;
    }

    const examiner = await prisma.examiner.findUnique({
      where: {
        id: examinerId,
      },
      include: {
        examinerBookAssignments: {
          include: {
            book: {
              include: {
                student: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!examiner) {
      const error = new Error("Examiner not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Examiner retrieved successfully",
      examiner,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for updating internal examiner mark
export const updateInternalExaminerMark = async (req, res, next) => {
  try {
    const { assignmentId } = req.params;
    const { mark, comments } = req.body;

    if (!assignmentId) {
      const error = new Error("Assignment ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (mark === undefined || mark === null) {
      const error = new Error("Mark is required");
      error.statusCode = 400;
      throw error;
    }

    // if (!comments) {
    //   const error = new Error("Comments are required");
    //   error.statusCode = 400;
    //   throw error;
    // }

    // Check if assignment exists
    const existingAssignment = await prisma.examinerBookAssignment.findUnique({
      where: {
        id: assignmentId,
      },
      include: {
        examiner: true,
        book: {
          include: {
            examinerAssignments: {
              include: {
                examiner: true,
              },
            },
          },
        },
      },
    });

    if (!existingAssignment) {
      const error = new Error("Assignment not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if examiner is internal
    if (existingAssignment.examiner.type !== "Internal") {
      const error = new Error("Only submit marks for internal examiners");
      error.statusCode = 403;
      throw error;
    }

    const parsedMark = parseFloat(mark);
    let status = null;
    let averageMark = parsedMark;

    // Check if there is an active external examiner
    const externalExaminerAssignment =
      existingAssignment.book.examinerAssignments.find(
        (assignment) =>
          assignment.examiner.type === "External" &&
          assignment.grade !== null &&
          assignment.id !== assignmentId &&
          assignment.isCurrent === true
      );

    console.log("externalExaminerAssignment", externalExaminerAssignment);

    const student = await prisma.student.findUnique({
      where: {
        id: existingAssignment.book.studentId,
      },
    });

    const resubmissionRequiredStatus = await prisma.statusDefinition.findFirst({
      where: {
        name: "failed & resubmission required",
      },
    });

    if (!resubmissionRequiredStatus) {
      const error = new Error(
        "Resubmission required status definition not found"
      );
      error.statusCode = 404;
      throw error;
    }

    const passedStatus = await prisma.statusDefinition.findFirst({
      where: {
        name: "passed & authorized for viva",
      },
    });

    if (!passedStatus) {
      const error = new Error("Passed status definition not found");
      error.statusCode = 404;
      throw error;
    }

    // If mark is below 60%, status is failed
    if (parsedMark < 60) {
      status = "FAILED";
      if (externalExaminerAssignment) {
        averageMark = (parsedMark + externalExaminerAssignment.grade) / 2;

        await prisma.book.update({
          where: {
            id: existingAssignment.bookId,
          },
          data: {
            averageExamMark: averageMark,
          },
        });

        // Check if the book status is already "failed & resubmission required"
        const currentBookStatus = await prisma.bookStatus.findFirst({
          where: {
            bookId: existingAssignment.bookId,
            isCurrent: true,
            definition: {
              id: resubmissionRequiredStatus.id,
            },
          },
        });

        // Only update statuses if the book is not already in failed and resubmission status
        if (!currentBookStatus) {
          if (averageMark >= 60) {
            // Update student and book statuses for passing
            await prisma.studentStatus.updateMany({
              where: {
                studentId: student.id,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new student status for passing
            await prisma.studentStatus.create({
              data: {
                student: { connect: { id: student.id } },
                definition: { connect: { id: passedStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
                updatedBy: { connect: { id: req.user.id } },
              },
            });

            // Update the previous book status to not be current
            await prisma.bookStatus.updateMany({
              where: {
                bookId: existingAssignment.bookId,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new book status for passing
            await prisma.bookStatus.create({
              data: {
                book: { connect: { id: existingAssignment.bookId } },
                definition: { connect: { id: passedStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
              },
            });
          } else {
            // Update student and book statuses for resubmission
            await prisma.studentStatus.updateMany({
              where: {
                studentId: student.id,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new student status for resubmission
            await prisma.studentStatus.create({
              data: {
                student: { connect: { id: student.id } },
                definition: { connect: { id: resubmissionRequiredStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
                updatedBy: { connect: { id: req.user.id } },
              },
            });

            // Update the previous book status to not be current
            await prisma.bookStatus.updateMany({
              where: {
                bookId: existingAssignment.bookId,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new book status for resubmission
            await prisma.bookStatus.create({
              data: {
                book: { connect: { id: existingAssignment.bookId } },
                definition: { connect: { id: resubmissionRequiredStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
              },
            });
          }
        }
      }
    } else {
      status = "PASSED";
      // If external examiner exists, calculate average
      if (externalExaminerAssignment) {
        averageMark = (parsedMark + externalExaminerAssignment.grade) / 2;

        // Update the book with the average mark
        await prisma.book.update({
          where: {
            id: existingAssignment.bookId,
          },
          data: {
            averageExamMark: averageMark,
          },
        });

        // Check if the book status is already "failed & resubmission required"
        const currentBookStatus = await prisma.bookStatus.findFirst({
          where: {
            bookId: existingAssignment.bookId,
            isCurrent: true,
            definition: {
              id: resubmissionRequiredStatus.id,
            },
          },
        });

        // Only update statuses if the book is not already in failed and resubmission status
        if (!currentBookStatus) {
          if (averageMark >= 60) {
            // Update student and book statuses for passing
            await prisma.studentStatus.updateMany({
              where: {
                studentId: student.id,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new student status for passing
            await prisma.studentStatus.create({
              data: {
                student: { connect: { id: student.id } },
                definition: { connect: { id: passedStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
                updatedBy: { connect: { id: req.user.id } },
              },
            });

            // Update the previous book status to not be current
            await prisma.bookStatus.updateMany({
              where: {
                bookId: existingAssignment.bookId,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new book status for passing
            await prisma.bookStatus.create({
              data: {
                book: { connect: { id: existingAssignment.bookId } },
                definition: { connect: { id: passedStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
              },
            });
          } else {
            // Update student and book statuses for resubmission
            await prisma.studentStatus.updateMany({
              where: {
                studentId: student.id,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new student status for resubmission
            await prisma.studentStatus.create({
              data: {
                student: { connect: { id: student.id } },
                definition: { connect: { id: resubmissionRequiredStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
                updatedBy: { connect: { id: req.user.id } },
              },
            });

            // Update the previous book status to not be current
            await prisma.bookStatus.updateMany({
              where: {
                bookId: existingAssignment.bookId,
                isCurrent: true,
              },
              data: {
                isCurrent: false,
                endDate: new Date(),
              },
            });

            // Create new book status for resubmission
            await prisma.bookStatus.create({
              data: {
                book: { connect: { id: existingAssignment.bookId } },
                definition: { connect: { id: resubmissionRequiredStatus.id } },
                isActive: true,
                startDate: new Date(),
                isCurrent: true,
              },
            });
          }
        }
      }
    }

    // Update the assignment with mark, comments and status
    const updatedAssignment = await prisma.examinerBookAssignment.update({
      where: {
        id: assignmentId,
      },
      data: {
        grade: parsedMark,
        feedback: comments,
        reportSubmittedAt: new Date(),
        status: status,
      },
    });

    res.status(200).json({
      message: "Internal examiner mark updated successfully",
      assignment: updatedAssignment,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Helper function to update student and book statuses
async function updateStatuses(studentId, bookId, statusDefinitionId, userId) {
  // Update the previous student status to not be current
  await prisma.studentStatus.updateMany({
    where: {
      studentId: studentId,
      isCurrent: true,
    },
    data: {
      isCurrent: false,
      endDate: new Date(),
    },
  });

  // Create new student status
  await prisma.studentStatus.create({
    data: {
      student: { connect: { id: studentId } },
      definition: { connect: { id: statusDefinitionId } },
      isActive: true,
      startDate: new Date(),
      isCurrent: true,
      updatedBy: { connect: { id: userId } },
    },
  });

  // Update the previous book status to not be current
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
      definition: { connect: { id: statusDefinitionId } },
      isActive: true,
      startDate: new Date(),
      isCurrent: true,
    },
  });
}

// Controller for updating an examiner
export const updateExaminer = async (req, res, next) => {
  try {
    const { examinerId } = req.params;
    const {
      name,
      primaryEmail,
      secondaryEmail,
      primaryPhone,
      secondaryPhone,
      institution,
      type,
    } = req.body;

    if (!examinerId) {
      const error = new Error("Examiner ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Check if examiner exists
    const existingExaminer = await prisma.examiner.findUnique({
      where: {
        id: examinerId,
      },
    });

    if (!existingExaminer) {
      const error = new Error("Examiner not found");
      error.statusCode = 404;
      throw error;
    }

    // If primary email is being changed, check if new email already exists
    if (primaryEmail && primaryEmail !== existingExaminer.primaryEmail) {
      const emailExists = await prisma.examiner.findUnique({
        where: {
          primaryEmail,
        },
      });

      if (emailExists) {
        const error = new Error(
          "An examiner with this primary email already exists"
        );
        error.statusCode = 409;
        throw error;
      }
    }

    // Update examiner
    const updatedExaminer = await prisma.examiner.update({
      where: {
        id: examinerId,
      },
      data: {
        name: name || existingExaminer.name,
        primaryEmail: primaryEmail || existingExaminer.primaryEmail,
        secondaryEmail: secondaryEmail || existingExaminer.secondaryEmail,
        primaryPhone: primaryPhone || existingExaminer.primaryPhone,
        secondaryPhone: secondaryPhone || existingExaminer.secondaryPhone,
        institution: institution || existingExaminer.institution,
        type: type || existingExaminer.type,
      },
    });

    res.status(200).json({
      message: "Examiner updated successfully",
      examiner: updatedExaminer,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for deleting an examiner
export const deleteExaminer = async (req, res, next) => {
  try {
    const { examinerId } = req.params;

    if (!examinerId) {
      const error = new Error("Examiner ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Check if examiner exists
    const existingExaminer = await prisma.examiner.findUnique({
      where: {
        id: examinerId,
      },
      include: {
        examinerBookAssignments: true,
      },
    });

    if (!existingExaminer) {
      const error = new Error("Examiner not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if examiner has any active assignments
    if (existingExaminer.examinerBookAssignments.length > 0) {
      const error = new Error(
        "Cannot delete examiner with active book assignments"
      );
      error.statusCode = 400;
      throw error;
    }

    // Delete examiner
    await prisma.examiner.delete({
      where: {
        id: examinerId,
      },
    });

    res.status(200).json({
      message: "Examiner deleted successfully",
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/** PROPOSAL DEFENSE CONTROLLERS - started here */
// Controller for scheduling a proposal defense
export const scheduleProposalDefense = async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const {
      scheduledDate,
      location,
      panelistIds,
      reviewerIds,
      chairpersonId,
      actingChairpersonId,
      minutesSecretaryId,
    } = req.body;

    // Validate inputs
    if (
      !proposalId ||
      !scheduledDate ||
      !Array.isArray(panelistIds) ||
      panelistIds.length === 0
    ) {
      throw new Error(
        "Proposal ID, scheduled date, and at least one panelist are required",
        { statusCode: 400 }
      );
    }

    // Check if proposal exists
    const existingProposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        student: {
          include: {
            supervisors: true, // Include supervisors
          },
        },
        statuses: {
          include: {
            definition: true,
          },
        },
      },
    });

    if (!existingProposal) {
      const error = new Error("Proposal not found");
      error.statusCode = 404;
      throw error;
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
    const currentDefenses = await prisma.proposalDefense.findMany({
      where: {
        proposalId: proposalId,
      },
      orderBy: {
        attempt: "desc",
      },
      take: 1,
    });

    const attemptNumber =
      currentDefenses.length > 0 ? currentDefenses[0].attempt + 1 : 1;

    // If there's a current defense, mark it as not current
    if (currentDefenses.length > 0 && currentDefenses[0].isCurrent) {
      await prisma.proposalDefense.update({
        where: { id: currentDefenses[0].id },
        data: { isCurrent: false },
      });
    }

    // Create new proposal defense
    const proposalDefense = await prisma.proposalDefense.create({
      data: {
        proposal: { connect: { id: proposalId } },
        scheduledDate: new Date(scheduledDate),
        location,
        status: "SCHEDULED",
        attempt: attemptNumber,
        panelists: { connect: panelistIds.map((id) => ({ id })) },
        isCurrent: true,
        chairperson: chairpersonId
          ? { connect: { id: chairpersonId } }
          : undefined,
        actingChairperson: actingChairpersonId
          ? { connect: { id: actingChairpersonId } }
          : undefined,
        minutesSecretary: minutesSecretaryId
          ? { connect: { id: minutesSecretaryId } }
          : undefined,
        reviewers: { connect: reviewerIds.map((id) => ({ id })) },
      },
      include: {
        panelists: true,
        reviewers: true,
        chairperson: true,
        minutesSecretary: true,
        proposal: {
          include: {
            student: true,
          },
        },
      },
    });

    // Update the proposal with the defense ID
    // await prisma.proposal.update({
    //     where: { id: proposalId },
    //     data: {
    //         proposalDefenseIds: {
    //             push: proposalDefense.id
    //         }
    //     }
    // });

    // Find the status definition for "waiting for proposal defense"
    const waitingForDefenseStatus = await prisma.statusDefinition.findFirst({
      where: {
        name: "waiting for proposal defense",
      },
    });

    if (waitingForDefenseStatus) {
      // Set all current proposal statuses to not current
      await prisma.proposalStatus.updateMany({
        where: {
          proposalId: proposalId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          endDate: new Date(),
        },
      });

      // Create new proposal status
      await prisma.proposalStatus.create({
        data: {
          proposal: { connect: { id: proposalId } },
          definition: { connect: { id: waitingForDefenseStatus.id } },
          startDate: new Date(),
          isActive: true,
          isCurrent: true,
        },
      });

      // Update student status as well
      // First, set all current student statuses to not current
      await prisma.studentStatus.updateMany({
        where: {
          studentId: existingProposal.student.id,
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
          student: { connect: { id: existingProposal.student.id } },
          definition: { connect: { id: waitingForDefenseStatus.id } },
          startDate: new Date(),
          isActive: true,
          isCurrent: true,
          updatedBy: { connect: { id: req.user.id } },
        },
      });
    }

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId: req.user.id,
        action: `Scheduled proposal defense for ${
          existingProposal.student?.firstName || "Unknown Student"
        } ${existingProposal.student?.lastName || ""}`,
        entityId: proposalDefense.id,
        entityType: "Proposal Defense",
      },
    });

    // Schedule defense invitation emails
    const defenseDate = new Date(proposalDefense.scheduledDate);
    const formattedDate = defenseDate.toLocaleDateString("en-US", {
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
        id: existingProposal.student.id,
        email: existingProposal.student.email,
        name: `${existingProposal.student.firstName} ${existingProposal.student.lastName}`,
      },
      // Add all supervisors
      ...existingProposal.student.supervisors.map((supervisor) => ({
        category: "SUPERVISOR",
        id: supervisor.id,
        email: supervisor.email,
        name: supervisor.name,
      })),
      // Add chairperson if exists
      ...(proposalDefense.chairperson
        ? [
            {
              category: "CHAIRPERSON",
              id: proposalDefense.chairperson.id,
              email: proposalDefense.chairperson.email,
              name: proposalDefense.chairperson.name,
            },
          ]
        : []),
      // Add minutes secretary if exists
      ...(proposalDefense.minutesSecretary
        ? [
            {
              category: "MINUTES_SECRETARY",
              id: proposalDefense.minutesSecretary.id,
              email: proposalDefense.minutesSecretary.email,
              name: proposalDefense.minutesSecretary.name,
            },
          ]
        : []),
      // Add panelists
      ...proposalDefense.panelists.map((panelist) => ({
        category: "PANELIST",
        id: panelist.id,
        email: panelist.email,
        name: panelist.name,
      })),
      // Add reviewers
      ...proposalDefense.reviewers.map((reviewer) => ({
        category: "REVIEWER",
        id: reviewer.id,
        email: reviewer.email,
        name: reviewer.name,
      })),
    ];

    // Schedule immediate invitations
    for (const participant of participants) {
      // Customize message based on participant type
      let message = `You are invited to attend the proposal defense of ${existingProposal.student.firstName} ${existingProposal.student.lastName}.`;
      let additionalContent = `
        <p><strong>Details:</strong></p>
        <ul>
            <li>Date: ${formattedDate}</li>
            <li>Venue: ${proposalDefense.location}</li>
            <li>Title: ${existingProposal.title}</li>
        </ul>
    `;

      if (participant.category === "STUDENT") {
        message = `Your proposal defense has been scheduled.`;
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
        title: `Proposal Defense Invitation - ${existingProposal.student.firstName} ${existingProposal.student.lastName}`,
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

    // Schedule reminder notifications (24 hours before defense)
    const reminderDate = new Date(defenseDate);
    reminderDate.setHours(reminderDate.getHours() - 24);

    for (const participant of participants) {
      // Customize reminder message based on participant type
      let message = `Reminder: Proposal defense for ${existingProposal.student.firstName} ${existingProposal.student.lastName} is scheduled for tomorrow.`;
      let additionalContent = `
        <p><strong>Defense Details:</strong></p>
        <ul>
            <li>Date: ${formattedDate}</li>
            <li>Venue: ${proposalDefense.location}</li>
            <li>Title: ${existingProposal.title}</li>
        </ul>
    `;

      if (participant.category === "STUDENT") {
        message = `Reminder: Your proposal defense is scheduled for tomorrow.`;
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
        <p>Please ensure you have prepared for the defense.</p>
        <p>Best regards,</p>
        <p>UMI System</p>
    `;
      await notificationService.scheduleNotification({
        type: "REMINDER",
        statusType: "PENDING",
        title: "Proposal Defense Reminder",
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

    // Schedule final reminder (1 hour before defense)
    const finalReminderDate = new Date(defenseDate);
    finalReminderDate.setHours(finalReminderDate.getHours() - 1);

    for (const participant of participants) {
      // Customize final reminder message based on participant type
      let message = `Final reminder: Proposal defense for ${existingProposal.student.firstName} ${existingProposal.student.lastName} is scheduled in 1 hour.`;
      let additionalContent = `
        <p><strong>Defense Details:</strong></p>
        <ul>
            <li>Date: ${formattedDate}</li>
            <li>Venue: ${proposalDefense.location}</li>
            <li>Title: ${existingProposal.title}</li>
        </ul>
    `;

      if (participant.category === "STUDENT") {
        message = `Final reminder: Your proposal defense is scheduled in 1 hour.`;
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
        title: "Final Reminder: Proposal Defense",
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
      message: "Proposal defense scheduled successfully",
      proposalDefense: proposalDefense,
    });
  } catch (error) {
    console.error("Error in scheduleProposalDefense:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for recording proposal defense verdict
export const recordProposalDefenseVerdict = async (req, res, next) => {
  try {
    const { defenseId } = req.params;
    const { verdict, comments } = req.body;

    // Validate inputs
    if (!defenseId || !verdict) {
      const error = new Error("Defense ID and verdict are required");
      error.statusCode = 400;
      throw error;
    }

    // Check if defense exists
    const existingDefense = await prisma.proposalDefense.findUnique({
      where: { id: defenseId },
      include: {
        proposal: {
          include: {
            student: {
              include: {
                supervisors: true,
              },
            },
          },
        },
      },
    });

    if (!existingDefense) {
      const error = new Error("Proposal defense not found");
      error.statusCode = 404;
      throw error;
    }

    // Determine defense status based on verdict
    let defenseStatus;
    switch (verdict) {
      case "PASS":
      case "PASS_WITH_MINOR_CORRECTIONS":
      case "PASS_WITH_MAJOR_CORRECTIONS":
        defenseStatus = "COMPLETED";
        break;
      case "FAIL":
        defenseStatus = "FAILED";
        break;
      case "RESCHEDULE":
        defenseStatus = "RESCHEDULED";
        break;
      default:
        defenseStatus = "COMPLETED";
    }

    // Update the defense with verdict and status
    const updatedDefense = await prisma.proposalDefense.update({
      where: { id: defenseId },
      data: {
        verdict: verdict,
        comments: comments,
        status: defenseStatus,
        completedAt: new Date(),
      },
      include: {
        panelists: true,
        chairperson: true,

        proposal: {
          include: {
            student: true,
          },
        },
      },
    });

    // If defense status is completed, update proposal and student status
    if (defenseStatus === "COMPLETED" || defenseStatus === "FAILED") {
      // Get appropriate status definition based on verdict
      const statusDefinitionName =
        defenseStatus === "COMPLETED"
          ? "passed-proposal graded"
          : "failed-proposal graded";

      const statusDefinition = await prisma.statusDefinition.findFirst({
        where: { name: statusDefinitionName },
      });

      if (!statusDefinition) {
        const error = new Error(
          `Status definition "${statusDefinitionName}" not found`
        );
        error.statusCode = 500;
        throw error;
      }

      // Update proposal status
      await prisma.proposalStatus.updateMany({
        where: {
          proposalId: existingDefense.proposal.id,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
          endDate: new Date(),
        },
      });

      // Create new proposal status
      await prisma.proposalStatus.create({
        data: {
          proposal: { connect: { id: existingDefense.proposal.id } },
          definition: { connect: { id: statusDefinition.id } },
          isCurrent: true,
          startDate: new Date(),
        },
      });

      // Update student status if student exists
      if (existingDefense.proposal.student) {
        await prisma.studentStatus.updateMany({
          where: {
            studentId: existingDefense.proposal.student.id,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
            endDate: new Date(),
          },
        });

        await prisma.studentStatus.create({
          data: {
            student: { connect: { id: existingDefense.proposal.student.id } },
            definition: { connect: { id: statusDefinition.id } },
            isCurrent: true,
            startDate: new Date(),
            isActive: true,
            updatedBy: { connect: { id: req.user.id } },
          },
        });
      }
    }

    // Log activity
    await prisma.userActivity.create({
      data: {
        userId: req.user.id,
        action: `Recorded proposal defense verdict (${verdict}) for ${
          existingDefense.proposal.student?.firstName || "Unknown Student"
        } ${existingDefense.proposal.student?.lastName || ""}`,
        entityId: updatedDefense.id,
        entityType: "Proposal Defense",
      },
    });

    // After updating the defense status, add notification scheduling
    if (defenseStatus === "COMPLETED" || defenseStatus === "FAILED") {
      // Schedule notifications for passed defense
      if (
        verdict === "PASS" ||
        verdict === "PASS_WITH_MINOR_CORRECTIONS" ||
        verdict === "PASS_WITH_MAJOR_CORRECTIONS"
      ) {
        const student = existingDefense.proposal.student;
        const supervisors = existingDefense.proposal.student.supervisors;
        const chairperson = existingDefense.chairperson;
        const defenseDate = new Date(existingDefense.scheduledDate);
        const complianceDueDate = new Date(defenseDate);
        complianceDueDate.setMonth(complianceDueDate.getMonth() + 2);

        // Format dates for email
        const formattedDefenseDate = defenseDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const formattedComplianceDate = complianceDueDate.toLocaleDateString(
          "en-US",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );

        // Determine correction type message
        let correctionMessage = "";
        if (verdict === "PASS_WITH_MINOR_CORRECTIONS") {
          correctionMessage = "minor corrections";
        } else if (verdict === "PASS_WITH_MAJOR_CORRECTIONS") {
          correctionMessage = "major corrections";
        }

        // Send immediate notification to chairperson (only initial verdict)
        await notificationService.scheduleNotification({
          type: "EMAIL",
          statusType: "PENDING",
          title: "Proposal Defense Verdict Recorded",
          message: `The verdict for the proposal defense you chaired has been recorded.`,
          recipientCategory: "CHAIRPERSON",
          recipientId: chairperson.id,
          recipientEmail: chairperson.email,
          recipientName: chairperson.name,
          scheduledFor: new Date(),
          metadata: {
            additionalContent: `
              <p><strong>Defense Details:</strong></p>
              <ul>
                <li>Student: ${student.firstName} ${student.lastName}</li>
                <li>Date: ${formattedDefenseDate}</li>
                <li>Title: ${existingDefense.proposal.title}</li>
                <li>Verdict: ${verdict}</li>
                ${comments ? `<li>Comments: ${comments}</li>` : ""}
              </ul>
              ${
                correctionMessage
                  ? `
                <p><strong>Corrections Information:</strong></p>
                <ul>
                  <li>Type of corrections: ${correctionMessage}</li>
                  <li>Compliance report due: ${formattedComplianceDate}</li>
                </ul>
              `
                  : ""
              }
              <p>Best regards,</p>
              <p>UMI System</p>
            `,
          },
        });

        // Send immediate notification to student
        await notificationService.scheduleNotification({
          type: "EMAIL",
          statusType: "PENDING",
          title: "Proposal Defense Result",
          message: `Congratulations! You have successfully defended your proposal${
            correctionMessage ? ` with ${correctionMessage}` : ""
          }.`,
          recipientCategory: "STUDENT",
          recipientId: student.id,
          recipientEmail: student.email,
          recipientName: `${student.firstName} ${student.lastName}`,
          scheduledFor: new Date(),
          metadata: {
            additionalContent: `
              <p><strong>Defense Details:</strong></p>
              <ul>
                <li>Date: ${formattedDefenseDate}</li>
                <li>Title: ${existingDefense.proposal.title}</li>
                <li>Verdict: ${verdict}</li>
                ${comments ? `<li>Comments: ${comments}</li>` : ""}
              </ul>
              ${
                correctionMessage
                  ? `
                <p><strong>Important:</strong></p>
                <ul>
                  <li>You are required to submit a compliance report by ${formattedComplianceDate}</li>
                  <li>The compliance report should address all corrections mentioned during the defense</li>
                  <li>Please work closely with your supervisor on the corrections</li>
                </ul>
              `
                  : ""
              }
              <p>Best regards,</p>
              <p>UMI System</p>
            `,
          },
        });

        // Send immediate notification to all supervisors
        for (const supervisor of supervisors) {
          await notificationService.scheduleNotification({
            type: "EMAIL",
            statusType: "PENDING",
            title: "Student Proposal Defense Result",
            message: `Your student ${student.firstName} ${
              student.lastName
            } has successfully defended their proposal${
              correctionMessage ? ` with ${correctionMessage}` : ""
            }.`,
            recipientCategory: "SUPERVISOR",
            recipientId: supervisor.id,
            recipientEmail: supervisor.email,
            recipientName: supervisor.name,
            scheduledFor: new Date(),
            metadata: {
              additionalContent: `
                <p><strong>Defense Details:</strong></p>
                <ul>
                  <li>Date: ${formattedDefenseDate}</li>
                  <li>Title: ${existingDefense.proposal.title}</li>
                  <li>Verdict: ${verdict}</li>
                  ${comments ? `<li>Comments: ${comments}</li>` : ""}
                </ul>
                ${
                  correctionMessage
                    ? `
                  <p><strong>Supervisor Action Required:</strong></p>
                  <ul>
                    <li>Please guide the student in addressing the corrections</li>
                    <li>Compliance report is due by ${formattedComplianceDate}</li>
                    <li>You will need to review and approve the compliance report</li>
                  </ul>
                `
                    : ""
                }
                <p>Best regards,</p>
                <p>UMI System</p>
              `,
            },
          });
        }

        // Schedule compliance report reminder (2 weeks before deadline)
        const reminderDate = new Date(complianceDueDate);
        reminderDate.setDate(reminderDate.getDate() - 14);

        // Reminder for student
        await notificationService.scheduleNotification({
          type: "REMINDER",
          statusType: "PENDING",
          title: "Compliance Report Reminder",
          message: `Reminder: Your compliance report is due in 2 weeks.`,
          recipientCategory: "STUDENT",
          recipientId: student.id,
          recipientEmail: student.email,
          recipientName: `${student.firstName} ${student.lastName}`,
          scheduledFor: reminderDate,
          metadata: {
            additionalContent: `
              <p><strong>Important Reminder:</strong></p>
              <ul>
                <li>Compliance report deadline: ${formattedComplianceDate}</li>
                <li>Please ensure all corrections have been addressed</li>
                <li>Submit your report to your supervisor for review</li>
                <li>Include all necessary documentation and evidence</li>
              </ul>
              <p>Best regards,</p>
              <p>UMI System</p>
            `,
          },
        });

        // Reminder for all supervisors
        for (const supervisor of supervisors) {
          await notificationService.scheduleNotification({
            type: "REMINDER",
            statusType: "PENDING",
            title: "Student Compliance Report Reminder",
            message: `Reminder: Your student's compliance report is due in 2 weeks.`,
            recipientCategory: "SUPERVISOR",
            recipientId: supervisor.id,
            recipientEmail: supervisor.email,
            recipientName: supervisor.name,
            scheduledFor: reminderDate,
            metadata: {
              additionalContent: `
                <p><strong>Supervisor Reminder:</strong></p>
                <ul>
                  <li>Student: ${student.firstName} ${student.lastName}</li>
                  <li>Compliance report deadline: ${formattedComplianceDate}</li>
                  <li>Please ensure the student has addressed all corrections</li>
                  <li>Review and approve the compliance report when submitted</li>
                </ul>
                <p>Best regards,</p>
                <p>UMI System</p>
              `,
            },
          });
        }

        // Final reminder (1 week before deadline)
        const finalReminderDate = new Date(complianceDueDate);
        finalReminderDate.setDate(finalReminderDate.getDate() - 7);

        // Final reminder for student
        await notificationService.scheduleNotification({
          type: "REMINDER",
          statusType: "PENDING",
          title: "Final Compliance Report Reminder",
          message: `Final reminder: Your compliance report is due in 1 week.`,
          recipientCategory: "STUDENT",
          recipientId: student.id,
          recipientEmail: student.email,
          recipientName: `${student.firstName} ${student.lastName}`,
          scheduledFor: finalReminderDate,
          metadata: {
            additionalContent: `
              <p><strong>Final Reminder:</strong></p>
              <ul>
                <li>Compliance report deadline: ${formattedComplianceDate}</li>
                <li>This is your final reminder to submit the report</li>
                <li>Ensure all corrections have been properly addressed</li>
                <li>Submit your report to your supervisor immediately</li>
              </ul>
              <p>Best regards,</p>
              <p>UMI System</p>
            `,
          },
        });

        // Final reminder for all supervisors
        for (const supervisor of supervisors) {
          await notificationService.scheduleNotification({
            type: "REMINDER",
            statusType: "PENDING",
            title: "Final Student Compliance Report Reminder",
            message: `Final reminder: Your student's compliance report is due in 1 week.`,
            recipientCategory: "SUPERVISOR",
            recipientId: supervisor.id,
            recipientEmail: supervisor.email,
            recipientName: supervisor.name,
            scheduledFor: finalReminderDate,
            metadata: {
              additionalContent: `
                <p><strong>Final Supervisor Reminder:</strong></p>
                <ul>
                  <li>Student: ${student.firstName} ${student.lastName}</li>
                  <li>Compliance report deadline: ${formattedComplianceDate}</li>
                  <li>Please ensure the student submits the report on time</li>
                  <li>Review and approve the compliance report when submitted</li>
                </ul>
                <p>Best regards,</p>
                <p>UMI System</p>
              `,
            },
          });
        }
      }
    }

    res.status(200).json({
      message: "Proposal defense verdict recorded successfully",
      proposalDefense: updatedDefense,
    });
  } catch (error) {
    console.error("Error in recordProposalDefenseVerdict:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller to get all proposal defenses
export const getProposalDefenses = async (req, res, next) => {
  try {
    const proposalDefenses = await prisma.proposalDefense.findMany({
      include: {
        proposal: {
          include: {
            student: true,
          },
        },
        panelists: true,
      },
      orderBy: {
        scheduledDate: "desc",
      },
    });

    res.status(200).json({
      message: "Proposal defenses retrieved successfully",
      proposalDefenses: proposalDefenses,
    });
  } catch (error) {
    console.error("Error in getProposalDefenses:", error);
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
      const error = new Error("Name and email are required");
      error.statusCode = 400;
      throw error;
    }

    // Check if panelist already exists
    const existingPanelist = await prisma.panelist.findUnique({
      where: { email },
    });

    if (existingPanelist) {
      const error = new Error("Panelist with this email already exists");
      error.statusCode = 400;
      throw error;
    }

    // Create new panelist
    const newPanelist = await prisma.panelist.create({
      data: {
        name,
        email,
        institution,
      },
    });

    res.status(201).json({
      message: "Panelist added successfully",
      panelist: newPanelist,
    });
  } catch (error) {
    console.error("Error in addNewPanelist:", error);
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
      message: "Panelists fetched successfully",
      panelists,
    });
  } catch (error) {
    console.error("Error in getAllPanelists:", error);
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
      const error = new Error("Book ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Fetch all vivas for the specified book with related panelists
    const vivas = await prisma.viva.findMany({
      where: {
        bookId,
      },
      include: {
        panelists: true,
      },
      orderBy: {
        scheduledDate: "desc",
      },
    });

    res.status(200).json({
      message: "Book vivas fetched successfully",
      vivas,
    });
  } catch (error) {
    console.error("Error in getBookVivas:", error);
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
    const { schoolId, campusId } = req.user;
    // Get total students count
    const totalStudents = await prisma.student.count({
      where: {
        schoolId,
        campusId,
      },
    });

    // Get recently enrolled students (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentlyEnrolled = await prisma.student.count({
      where: {
        schoolId,
        campusId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Get students by status
    const statusCounts = await prisma.studentStatus.groupBy({
      by: ["definitionId"],
      where: {
        isCurrent: true,
        student: {
          schoolId,
          campusId,
        },
      },
      _count: {
        studentId: true,
      },
    });

    // Get status definitions to map counts
    const statusDefinitions = await prisma.statusDefinition.findMany();

    // Map status counts to their names
    const statusMap = {};
    statusCounts.forEach((status) => {
      const definition = statusDefinitions.find(
        (def) => def.id === status.definitionId
      );
      if (definition) {
        statusMap[definition.name.toLowerCase().replace(/\s+/g, "")] =
          status._count.studentId;
      }
    });

    // Extract specific status counts
    const workshop = statusMap.workshop || 0;
    const normalProgress = statusMap.normalprogress || 0;
    const underExamination = statusMap.underexamination || 0;

    // Get total ongoing students (excluding graduated and deregistered)
    const ongoingStudents = await prisma.student.count({
      where: {
        schoolId,
        campusId,
        statuses: {
          some: {
            isCurrent: true,
            definition: {
              name: {
                notIn: ["graduated", "deregistered"],
              },
            },
          },
        },
      },
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
      ongoingStudents: ongoingStudents.toString(),
    });
  } catch (error) {
    console.error("Error in getDashboardStats:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting student status statistics for dashboard charts
export const getStatusStatistics = async (req, res, next) => {
  try {
    const { schoolId, campusId } = req.user;
    const { category = "main" } = req.query;
    console.log("category", category);
    let whereCondition = {};
    let stats = [];

    // Define different category filters
    if (category === "main") {
      whereCondition = {
        isCurrent: true,
        student: {
          schoolId,
          campusId,
        },
        definition: {
          name: {
            in: [
              "normal progress",
              "fieldwork",
              "under examination",
              "scheduled for viva",
              "results approved",
              "results sent to schools",
              "results approved by senate",
            ],
          },
        },
      };

      stats = await prisma.studentStatus.groupBy({
        by: ["definitionId"],
        _count: true,
        where: whereCondition,
      });
    } else if (category === "proposal") {
      whereCondition = {
        isCurrent: true,
        proposal: {
          student: {
            schoolId,
            campusId,
          },
        },
        definition: {
          name: {
            in: [
              "proposal received",
              "proposal in review",
              "waiting for proposal defense",
              "compliance report submitted",
              "letter to field issued",
            ],
          },
        },
      };

      stats = await prisma.proposalStatus.groupBy({
        by: ["definitionId"],
        _count: true,
        where: whereCondition,
      });
    } else if (category === "book") {
      whereCondition = {
        book: {
          student: {
            schoolId,
            campusId,
          },
        },
        definition: {
          name: {
            in: [
              "book planning",
              "book writing",
              "dissertation submitted",
              "book under review",
              "final dissertation & compliance report received",
            ],
          },
        },
      };

      stats = await prisma.bookStatus.groupBy({
        by: ["definitionId"],
        _count: true,
        where: whereCondition,
      });
    }

    // Then get the definitions to map names
    const definitions = await prisma.statusDefinition.findMany({
      where: {
        id: {
          in: stats.map((stat) => stat.definitionId),
        },
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    // Create a map of definition IDs to names and colors
    const definitionMap = definitions.reduce((acc, def) => {
      acc[def.id] = {
        name: def.name,
        color: def.color || getDefaultColor(def.name),
      };
      return acc;
    }, {});

    // Transform the data into an array with status, students, and fill
    const statusArray = stats.map((stat) => {
      const definition = definitionMap[stat.definitionId];
      return {
        status: definition.name,
        students: stat._count,
        fill: definition.color,
      };
    });

    res.json(statusArray);
  } catch (error) {
    console.error("Error in getStatusStatistics:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Helper function to get default colors if not provided in the database
const getDefaultColor = (statusName) => {
  const colorMap = {
    "normal progress": "#22C55E",
    fieldwork: "#3B82F6",
    "under examination": "#EAB308",
    "scheduled for viva": "#EC4899",
    "results approved": "#14B8A6",
  };

  return colorMap[statusName.toLowerCase()] || "#6B7280"; // Default gray color
};

export const getProgressTrends = async (req, res, next) => {
  try {
    const { schoolId, campusId } = req.user;
    const { timeRange } = req.query;
    const daysToLookBack =
      timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToLookBack);

    // Get all relevant status changes in the time period
    const statusChanges = await prisma.studentStatus.findMany({
      where: {
        student: {
          schoolId,
          campusId,
        },
        createdAt: {
          gte: startDate,
        },
        definition: {
          name: {
            in: [
              "dissertation submitted",
              "under examination",
              "scheduled for viva",
            ],
          },
        },
      },
      include: {
        definition: {
          select: {
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Generate array of dates
    const dates = [];
    for (
      let d = new Date(startDate);
      d <= new Date();
      d.setDate(d.getDate() + 1)
    ) {
      dates.push(new Date(d));
    }

    // Define default colors for each status
    const defaultColors = {
      "dissertation submitted": "#23388F", // dark blue
      "under examination": "#EAB308", // yellow
      "scheduled for viva": "#EC4899", // pink
    };

    // Get the colors from status definitions
    const statusDefinitions = await prisma.statusDefinition.findMany({
      where: {
        name: {
          in: [
            "dissertation submitted",
            "under examination",
            "scheduled for viva",
          ],
        },
      },
      select: {
        name: true,
        color: true,
      },
    });

    // Create a map of status names to their colors
    const statusColors = {};
    statusDefinitions.forEach((def) => {
      statusColors[def.name] = def.color || defaultColors[def.name];
    });

    // Use these colors consistently across all data points
    const submissionsColor =
      statusColors["dissertation submitted"] ||
      defaultColors["dissertation submitted"];
    const examinationsColor =
      statusColors["under examination"] || defaultColors["under examination"];
    const vivasColor =
      statusColors["scheduled for viva"] || defaultColors["scheduled for viva"];
    // Transform the data into daily counts
    const stats = dates.map((date) => {
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayStats = statusChanges.filter(
        (status) => status.createdAt >= dayStart && status.createdAt <= dayEnd
      );

      const submissionStats = dayStats.filter(
        (s) => s.definition.name === "dissertation submitted"
      );
      const examinationStats = dayStats.filter(
        (s) => s.definition.name === "under examination"
      );
      const vivaStats = dayStats.filter(
        (s) => s.definition.name === "scheduled for viva"
      );

      return {
        date: dayStart.toISOString().split("T")[0],
        submissions: submissionStats.length,
        submissionsColor: submissionsColor,
        examinations: examinationStats.length,
        examinationsColor: examinationsColor,
        vivas: vivaStats.length,
        vivasColor: vivasColor,
      };
    });

    res.json(stats);
  } catch (error) {
    console.error("Error fetching progress trends:", error);
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
              },
            },
          },
        },
      },
      orderBy: {
        scheduledFor: "desc",
      },
    });

    console.log("notifications", notifications);

    res.status(200).json({
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
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
            notifications: true,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    });

    const today = new Date();
    const statusReports = [];

    for (const student of students) {
      // Get current status
      const currentStatus = student.studentStatuses.find(
        (status) => status.isCurrent
      );

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
      const daysInStatus = Math.floor(
        (today - startDate) / (1000 * 60 * 60 * 24)
      );

      // Calculate days remaining or days overdue
      let daysRemaining = 0;
      let daysOverdue = 0;

      if (isDelayed) {
        daysOverdue = Math.floor(
          (today - expectedEndDate) / (1000 * 60 * 60 * 24)
        );
      } else {
        daysRemaining = Math.floor(
          (expectedEndDate - today) / (1000 * 60 * 60 * 24)
        );
      }

      // Get notifications related to this status
      const statusNotifications = currentStatus.notifications || [];

      // Prepare the status report for this student
      statusReports.push({
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          email: student.email,
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
          daysOverdue: isDelayed ? daysOverdue : 0,
        },
        notifications: statusNotifications.map((notification) => ({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          scheduledFor: notification.scheduledFor,
          sentAt: notification.sentAt,
          statusType: notification.statusType,
        })),
      });
    }

    res.status(200).json({
      statusReports,
    });
  } catch (error) {
    console.error("Error generating all students status report:", error);
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
            notifications: true,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    });

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    // Get current status (should be the first one as we ordered by startDate desc)
    const currentStatus = student.studentStatuses.find(
      (status) => status.isCurrent
    );

    if (!currentStatus) {
      const error = new Error("No current status found for student");
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
    const daysInStatus = Math.floor(
      (today - startDate) / (1000 * 60 * 60 * 24)
    );

    // Calculate days remaining or days overdue
    let daysRemaining = 0;
    let daysOverdue = 0;

    if (isDelayed) {
      daysOverdue = Math.floor(
        (today - expectedEndDate) / (1000 * 60 * 60 * 24)
      );
    } else {
      daysRemaining = Math.floor(
        (expectedEndDate - today) / (1000 * 60 * 60 * 24)
      );
    }

    // Get notifications related to this status
    const statusNotifications = await prisma.notification.findMany({
      where: {
        studentStatusId: currentStatus.id,
      },
      orderBy: {
        scheduledFor: "desc",
      },
    });

    // Prepare the status report
    const statusReport = {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
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
        daysOverdue: isDelayed ? daysOverdue : 0,
      },
      notifications: statusNotifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        scheduledFor: notification.scheduledFor,
        sentAt: notification.sentAt,
        statusType: notification.statusType,
      })),
      statusHistory: student.studentStatuses
        .filter((status) => !status.isCurrent)
        .map((status) => ({
          id: status.id,
          name: status.definition.name,
          startDate: status.startDate,
          endDate: status.endDate,
          expectedDurationDays: status.definition.expectedDurationDays,
          actualDurationDays: status.endDate
            ? Math.floor(
                (new Date(status.endDate) - new Date(status.startDate)) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        })),
    };

    res.status(200).json({
      statusReport,
    });
  } catch (error) {
    console.error("Error generating student status report:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting all supervisors
export const getAllSupervisors = async (req, res, next) => {
  try {
    const supervisors = await prisma.supervisor.findMany({
      include: {
        school: true,
        campus: true,
        department: true,
        students: {
          include: {
            statuses: {
              include: {
                definition: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({
      supervisors,
    });
  } catch (error) {
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

    //check if faculty exists
    const faculty = await prisma.user.findUnique({
      where: { email },
    });

    if (!faculty) {
      const error = new Error("No account found with that email address");
      error.statusCode = 404;
      throw error;
    }
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const error = new Error("No account found with that email address");
      error.statusCode = 404;
      throw error;
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // Token valid for 1 hour

    // Save the reset token to the faculty record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // });

    // Frontend URL for password reset
    const frontendUrl =
      process.env.FACULTY_CLIENT_URL || "https://umischoolportal.netlify.app";
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
      subject: "Password Reset Request",
      htmlContent: emailTemplate,
    });

    res.status(200).json({
      message: "Password reset link has been sent to your email",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
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
          gt: new Date(),
        },
      },
    });

    if (!user) {
      const error = new Error("Invalid or expired reset token");
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
        resetTokenExpiry: null,
      },
    });

    // });

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
    await emailService.sendEmail({
      to: user.email,
      subject: "Password Reset Successful",
      htmlContent: confirmationTemplate,
    });

    res.status(200).json({
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting all faculty members
export const getAllFacultyMembers = async (req, res, next) => {
  try {
    const schoolFacultyMember = await prisma.facultyMember.findUnique({
      where: {
        userId: req.user.id,
      },
      include: {
        school: true,
        campus: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            designation: true,
          },
        },
      },
    });
    const [supervisors] = await Promise.all([
      prisma.supervisor.findMany({
        where: {
          schoolId: schoolFacultyMember?.schoolId,
        },
        include: {
          school: true,
          campus: true,
          department: true,
        },
      }),
    ]);

    res.status(200).json({ facultyMembers: [...supervisors] });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting all campuses - working
export const getAllCampuses = async (req, res, next) => {
  try {
    const campuses = await prisma.campus.findMany({
      include: {
        schools: true,
      },
    });

    res.status(200).json({
      message: "Campuses fetched successfully",
      campuses,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting all departments of a school
export const getAllDepartments = async (req, res, next) => {
  try {
    const { schoolId } = req.params;

    // Check if school exists
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      const error = new Error("School not found");
      error.statusCode = 404;
      throw error;
    }

    const departments = await prisma.department.findMany({
      where: { schoolId },
      include: {
        school: true,
      },
    });

    res.status(200).json({
      message: "Departments fetched successfully",
      departments,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting all schools
export const getAllSchools = async (req, res, next) => {
  try {
    console.log("getAllSchools");
    const schools = await prisma.school.findMany({
      include: {
        campus: true,
        departments: true,
        members: true,
      },
    });

    res.status(200).json({
      message: "Schools fetched successfully",
      schools,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for creating a supervisor
export const createSupervisor = async (req, res, next) => {
  try {
    const {
      name,
      title,
      workEmail,
      personalEmail,
      primaryPhone,
      secondaryPhone,
      designation,
      schoolId,
      campusId,
      departmentId,
      facultyType,
      employeeId,
      password,
    } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Set role based on faculty type
    let role = "SUPERVISOR";

    // Create user first
    const user = await prisma.user.create({
      data: {
        name,
        title,
        email: workEmail,
        designation,
        password: hashedPassword,
        role,
        phone: primaryPhone,
      },
    });

    // Create supervisor and link user
    const supervisor = await prisma.supervisor.create({
      data: {
        title,
        name,
        workEmail,
        personalEmail,
        primaryPhone,
        secondaryPhone,
        designation,
        school: { connect: { id: schoolId } },
        campus: { connect: { id: campusId } },
        department: { connect: { id: departmentId } },
        facultyType,
        role,
        employeeId,
        user: { connect: { id: user.id } },
      },
    });

    res.status(201).json({
      message: "Supervisor created successfully",
      supervisor,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for getting a single supervisor
export const getSupervisor = async (req, res, next) => {
  try {
    const { supervisorId } = req.params;

    const supervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      include: {
        school: true,
        campus: true,
        department: true,
      },
    });

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      supervisor,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get students assigned to supervisor
export const getAssignedStudents = async (req, res, next) => {
  try {
    const { supervisorId } = req.params;

    // Check if supervisor exists
    const supervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      include: {
        user: true,
      },
    });

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    // Get all students assigned to this supervisor
    const assignedStudents = await prisma.student.findMany({
      where: {
        supervisors: {
          some: {
            id: supervisorId,
          },
        },
      },
      include: {
        campus: true,
        statuses: {
          include: {
            definition: true,
          },
        },
        school: true,
        department: true,
      },
    });

    res.status(200).json({
      message: "Students retrieved successfully",
      supervisor: {
        id: supervisor.id,
        name: supervisor.user.name,
        email: supervisor.user.email,
      },
      students: assignedStudents,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for updating a supervisor
export const updateSupervisor = async (req, res, next) => {
  try {
    const { supervisorId } = req.params;
    const { schoolId, campusId, departmentId, userId, ...updateData } =
      req.body;

    // Get existing supervisor data before update
    const existingSupervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      include: {
        user: true,
      },
    });

    if (!existingSupervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if email is being changed and if it already exists
    if (updateData.workEmail !== existingSupervisor.workEmail) {
      const emailExists = await prisma.user.findUnique({
        where: { email: updateData.workEmail },
      });

      if (emailExists) {
        const error = new Error("Work email already exists");
        error.statusCode = 400;
        throw error;
      }

      // Update the user's email
      await prisma.user.update({
        where: { id: existingSupervisor.user.id },
        data: { email: updateData.workEmail },
      });
    }

    // Track changes
    const changes = [];
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== existingSupervisor[key]) {
        changes.push({
          field: key,
          oldValue: existingSupervisor[key],
          newValue: updateData[key],
        });
      }
    });

    const updatedSupervisor = await prisma.supervisor.update({
      where: { id: supervisorId },
      data: {
        ...updateData,
        school: schoolId ? { connect: { id: schoolId } } : undefined,
        campus: campusId ? { connect: { id: campusId } } : undefined,
        department: departmentId
          ? { connect: { id: departmentId } }
          : undefined,
      },
      include: {
        school: true,
        campus: true,
        department: true,
        user: true,
      },
    });

    res.status(200).json({
      message: "Supervisor updated successfully",
      supervisor: updatedSupervisor,
      changes,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for assigning students to supervisor
export const assignStudentsToSupervisor = async (req, res, next) => {
  try {
    const { supervisorId } = req.params;
    const { studentIds } = req.body;

    // Check if supervisor exists
    const supervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      include: {
        user: true,
      },
    });

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if all students exist and if they already have supervisors
    const students = await prisma.student.findMany({
      where: {
        id: {
          in: studentIds,
        },
      },
      include: {
        supervisors: true,
      },
    });

    if (students.length !== studentIds.length) {
      const error = new Error("One or more students not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if any student already has a supervisor
    const studentsWithSupervisors = students.filter(
      (student) => student.supervisors.length > 0
    );
    if (studentsWithSupervisors.length > 0) {
      const error = new Error(
        "One or more students already have supervisors assigned"
      );
      error.statusCode = 400;
      error.details = studentsWithSupervisors.map((student) => student.id);
      throw error;
    }

    // Get normal progress status definition
    const normalProgressStatus = await prisma.statusDefinition.findFirst({
      where: {
        name: "normal progress",
      },
    });

    if (!normalProgressStatus) {
      const error = new Error("Normal Progress status definition not found");
      error.statusCode = 404;
      throw error;
    }

    // Update all students to be assigned to this supervisor and update their status
    const updatePromises = studentIds.map(async (studentId) => {
      // First update all existing statuses to not current
      await prisma.studentStatus.updateMany({
        where: {
          studentId: studentId,
          isCurrent: true,
        },
        data: { isCurrent: false, endDate: new Date() },
      });

      // Create new normal progress status
      await prisma.studentStatus.create({
        data: {
          student: { connect: { id: studentId } },
          definition: { connect: { id: normalProgressStatus.id } },
          isCurrent: true,
          startDate: new Date(),
          conditions: "Normal Progress",
          isActive: true,
        },
      });

      // Assign supervisor
      return prisma.student.update({
        where: { id: studentId },
        data: { supervisors: { connect: { id: supervisorId } } },
      });
    });

    await Promise.all(updatePromises);

    // Get updated students with their details
    const updatedStudents = await prisma.student.findMany({
      where: {
        id: {
          in: studentIds,
        },
      },
      include: {
        campus: true,
        statuses: {
          where: {
            isCurrent: true,
          },
          include: {
            definition: true,
          },
        },
      },
    });

    // Track this activity
    await prisma.userActivity.create({
      data: {
        user: { connect: { id: req.user?.id } },
        action: "ASSIGN_STUDENTS",
        entityType: "Supervisor",
        entityId: supervisorId,
        details: JSON.stringify({
          supervisorId,
          studentIds,
          description: `Assigned ${studentIds.length} student(s) to supervisor ${supervisor.user.name}`,
        }),
      },
    });

    res.status(200).json({
      message: "Students assigned successfully",
      students: updatedStudents,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for deleting a supervisor
export const deleteSupervisor = async (req, res, next) => {
  try {
    const { supervisorId } = req.params;

    const supervisor = await prisma.supervisor.findUnique({
      where: { id: supervisorId },
      include: {
        user: true,
        students: true,
      },
    });

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if supervisor has any students
    if (supervisor.students.length > 0) {
      const error = new Error(
        "Cannot delete supervisor with assigned students"
      );
      error.statusCode = 400;
      throw error;
    }

    // Delete associated user
    await prisma.user.delete({
      where: { id: supervisor.user.id },
    });

    // Delete supervisor
    await prisma.supervisor.delete({
      where: { id: supervisorId },
    });

    res.status(200).json({
      message: "Supervisor deleted successfully",
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller for changing a student's supervisor
export const changeStudentSupervisor = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { oldSupervisorId, newSupervisorId, reason } = req.body;

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        supervisors: true,
        user: true,
      },
    });

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if old supervisor is actually assigned to the student
    const isOldSupervisorAssigned = student.supervisors.some(
      (supervisor) => supervisor.id === oldSupervisorId
    );

    if (!isOldSupervisorAssigned) {
      const error = new Error(
        "The specified old supervisor is not assigned to this student"
      );
      error.statusCode = 400;
      throw error;
    }

    // Check if new supervisor exists
    const newSupervisor = await prisma.supervisor.findUnique({
      where: { id: newSupervisorId },
      include: {
        user: true,
      },
    });

    if (!newSupervisor) {
      const error = new Error("New supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    // Get old supervisor details for the activity log
    const oldSupervisor = await prisma.supervisor.findUnique({
      where: { id: oldSupervisorId },
      include: {
        user: true,
      },
    });

    // Update student's supervisors (remove old, add new)
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: {
        supervisors: {
          disconnect: { id: oldSupervisorId },
          connect: { id: newSupervisorId },
        },
      },
      include: {
        supervisors: {
          include: {
            user: true,
          },
        },
        campus: true,
        school: true,
        department: true,
      },
    });

    // Track this activity
    await prisma.userActivity.create({
      data: {
        user: { connect: { id: req.user?.id } },
        action: "CHANGE_SUPERVISOR",
        entityType: "Student",
        entityId: studentId,
        details: JSON.stringify({
          studentId,
          oldSupervisorId,
          oldSupervisorName: oldSupervisor?.user?.name,
          newSupervisorId,
          newSupervisorName: newSupervisor.user.name,
          reason,
          description: `Changed supervisor for student ${student.name} from ${oldSupervisor?.user?.name} to ${newSupervisor.user.name}`,
        }),
      },
    });

    // <p>This change was made for the following reason: ${reason}</p>
    // Send email notification to the new supervisor through notification service
    await notificationService.scheduleNotification({
      type: "EMAIL",
      statusType: "PENDING",
      title: "New Student Supervision Assignment",
      message: `You have been assigned as a supervisor for student ${student.firstName} ${student.lastName} .`,
      recipientCategory: "USER",
      recipientId: newSupervisor.user.id,
      // recipientEmail: newSupervisor.user.email,
      recipientEmail: "stephaniekirathe@gmail.com",
      recipientName: newSupervisor.user.name,
      scheduledFor: new Date(Date.now() + 60000), // Schedule for delivery 1 minute from now
      // scheduledFor: new Date(new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })).getTime() + 5 * 60000), // Schedule for delivery in Uganda timezone, 5 minutes from now
      metadata: {
        studentId: student.id,
        supervisorId: newSupervisor.id,
        // supervisorType: isPrimary ? 'primary' : 'secondary',
        additionalContent: `<p>Please log in to the UMI Supervisor Platform to view more details about this student</p>
              <p>Thank you,</p>
              <p>UMI Research Management Team </p>
              `,
      },
    });

    // Send email notification to the student through notification service
    await notificationService.scheduleNotification({
      type: "EMAIL",
      statusType: "PENDING",
      title: "Supervisor Change Notification",
      message: `Your supervisor has been changed from ${oldSupervisor?.user?.title} ${oldSupervisor?.user?.name} to ${newSupervisor.user.title} ${newSupervisor.user.name}. `,
      recipientCategory: "USER",
      recipientId: student?.user?.id,
      // recipientEmail: student?.user?.email,
      recipientEmail: "stephaniekirathe@gmail.com",

      recipientName: student?.user?.name,
      scheduledFor: new Date(Date.now() + 60000), // Schedule for delivery 1 minute from now
      // scheduledFor: new Date(new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })).getTime() + 60000), // Schedule for delivery in Uganda timezone, 1 minute from now
      metadata: {
        oldSupervisorId: oldSupervisorId,
        newSupervisorId: newSupervisorId,
        // supervisorType: isPrimary ? 'primary' : 'secondary',
        reason: reason,
        additionalContent: `
            
              <p>If you have any questions about this change, please contact thr research administration office.</p>
              <p>Thank you,</p>
              <p>UMI Research Management Team </p>
              `,
      },
    });

    res.status(200).json({
      message: "Supervisor changed successfully",
      student: updatedStudent,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get staff members for faculty client
export const getStaffMembers = async (req, res, next) => {
    try {
        const { role, isActive, search, isExternal, schoolId, departmentId, campusId } = req.query;

        const where = {};

        // Filter by role if specified (check if staff member has any of the specified roles)
        if (role && role !== 'all') {
            where.OR = [
                { supervisorId: { not: null } },
                { examinerId: { not: null } },
                { reviewerId: { not: null } },
                { panelistId: { not: null } }
            ];
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        // Filter by internal/external status
        if (isExternal !== undefined) {
            where.isExternal = isExternal === 'true';
        }

        // Filter by institutional affiliations
        if (schoolId) {
            where.schoolId = schoolId;
        }
        if (departmentId) {
            where.departmentId = departmentId;
        }
        if (campusId) {
            where.campusId = campusId;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { designation: { contains: search, mode: 'insensitive' } },
                { specialization: { contains: search, mode: 'insensitive' } },
                { externalInstitution: { contains: search, mode: 'insensitive' } },
                { externalDepartment: { contains: search, mode: 'insensitive' } }
            ];
        }

        const staffMembers = await prisma.staffMember.findMany({
            where,
            include: {
                supervisor: true,
                examiner: true,
                reviewer: true,
                panelist: true,
                school: true,
                department: true,
                campus: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                updatedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            message: 'Staff members retrieved successfully',
            staffMembers
        });

    } catch (error) {
        console.error('Error in getStaffMembers:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get staff members for reviewer creation (those without reviewerId and internal)
export const getStaffMembersForReviewer = async (req, res, next) => {
    try {
        // Get all internal, active staff members who don't have a reviewerId
        const staffMembers = await prisma.staffMember.findMany({
            where: {
                isExternal: false,   // Internal staff only
                isActive: true,      // Active staff only
                reviewerId: undefined     // No existing reviewer role
            },
            include: {
                school: true,
                department: true,
                campus: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                updatedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        res.status(200).json({
            message: 'Staff members for reviewer creation retrieved successfully',
            staffMembers
        });

    } catch (error) {
        console.error('Error in getStaffMembersForReviewer:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Create reviewer from staff member
export const createReviewerFromStaff = async (req, res, next) => {
    try {
        const { staffMemberId } = req.params;

        // Find the staff member
        const staffMember = await prisma.staffMember.findUnique({
            where: { id: staffMemberId },
            include: {
                school: true,
                department: true,
                campus: true
            }
        });

        if (!staffMember) {
            const error = new Error('Staff member not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if staff member already has a reviewer role
        if (staffMember.reviewerId) {
            const error = new Error('Staff member already has a reviewer role');
            error.statusCode = 400;
            throw error;
        }

        // Check if staff member is internal
        if (staffMember.isExternal) {
            const error = new Error('External staff members cannot be assigned as reviewers');
            error.statusCode = 400;
            throw error;
        }

        // Create the reviewer without user account
        const newReviewer = await prisma.reviewer.create({
            data: {
                name: staffMember.name,
                email: staffMember.email,
                primaryPhone: staffMember.phone,
                institution: staffMember.isExternal ? staffMember.externalInstitution : 'Uganda Management Institute',
                specialization: staffMember.specialization,
                campus: staffMember.campusId ? { connect: { id: staffMember.campusId } } : undefined
            }
        });

        // Connect the reviewer to the staff member
        await prisma.staffMember.update({
            where: { id: staffMember.id },
            data: { reviewerId: newReviewer.id }
        });

        res.status(201).json({
            message: 'Reviewer created successfully from staff member',
            reviewer: {
                id: newReviewer.id,
                name: newReviewer.name,
                email: newReviewer.email,
                specialization: newReviewer.specialization,
                institution: newReviewer.institution
            }
        });

    } catch (error) {
        console.error('Error in createReviewerFromStaff:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Create a new staff member
export const createStaffMember = async (req, res, next) => {
    try {
        const {
            name,
            title,
            email,
            phone,
            designation,
            specialization,
            qualifications,
            experience,
            bio,
            profileImage,
            // Institutional affiliations
            schoolId,
            departmentId,
            campusId,
            // External institution information
            externalInstitution,
            externalDepartment,
            externalLocation,
            isExternal,
        } = req.body;

        // Check if staff member with email already exists
        const existingStaffMember = await prisma.staffMember.findUnique({
            where: { email }
        });

        if (existingStaffMember) {
            const error = new Error('Staff member with this email already exists.');
            error.statusCode = 400;
            throw error;
        }

        // Prepare institutional connections
        const institutionalConnections = {};
        if (!isExternal) {
            // Internal staff member - use institutional relations
            if (schoolId) {
                institutionalConnections.school = { connect: { id: schoolId } };
            }
            if (departmentId) {
                institutionalConnections.department = { connect: { id: departmentId } };
            }
            if (campusId) {
                institutionalConnections.campus = { connect: { id: campusId } };
            }
        } else {
            // External staff member - use external institution fields
            institutionalConnections.externalInstitution = externalInstitution;
            institutionalConnections.externalDepartment = externalDepartment;
            institutionalConnections.externalLocation = externalLocation;
            institutionalConnections.isExternal = true;
        }

        // Create staff member
        const staffMember = await prisma.staffMember.create({
            data: {
                name,
                title,
                email,
                phone,
                designation,
                specialization,
                qualifications,
                experience,
                bio,
                profileImage,
                isActive: true,
                createdBy: { connect: { id: req.user.id } },
                ...institutionalConnections,
            },
            include: {
                supervisor: true,
                examiner: true,
                reviewer: true,
                panelist: true,
                school: true,
                department: true,
                campus: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        res.status(201).json({
            message: 'Staff member created successfully',
            staffMember
        });

    } catch (error) {
        console.error('Error in createStaffMember:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Create panelist from staff member
export const createPanelistFromStaff = async (req, res, next) => {
    try {
        const { staffMemberId } = req.params;

        // Find the staff member
        const staffMember = await prisma.staffMember.findUnique({
            where: { id: staffMemberId },
            include: {
                school: true,
                department: true,
                campus: true
            }
        });

        if (!staffMember) {
            const error = new Error('Staff member not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if staff member already has a panelist role
        if (staffMember.panelistId) {
            const error = new Error('Staff member already has a panelist role');
            error.statusCode = 400;
            throw error;
        }

        // Check if staff member is internal
        if (staffMember.isExternal) {
            const error = new Error('External staff members cannot be assigned as panelists');
            error.statusCode = 400;
            throw error;
        }

        // Create the panelist directly (no user account needed)
        const newPanelist = await prisma.panelist.create({
            data: {
                name: staffMember.name,
                email: staffMember.email,
                institution: staffMember.isExternal ? staffMember.externalInstitution : 'Uganda Management Institute',
                campus: staffMember.campusId ? { connect: { id: staffMember.campusId } } : undefined
            }
        });

        // Update the staff member to link to the panelist
        await prisma.staffMember.update({
            where: { id: staffMemberId },
            data: {
                panelistId: newPanelist.id
            }
        });

        res.status(201).json({
            message: 'Staff member converted to panelist successfully',
            panelist: newPanelist
        });

    } catch (error) {
        console.error('Error in createPanelistFromStaff:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};
