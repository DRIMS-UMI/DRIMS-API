import prisma from "../../../utils/db.mjs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sanitizeForLog } from "../../../utils/sanitizeForLog.js";
import { notificationService } from "../../../services/notificationService2.js";
import emailService from "../../../services/emailService2.js";
import { storeFileToGridFS, openGridFSStream, deleteFromGridFS } from "../../../utils/gridfs.mjs";

//Supervisor login Controller
export const loginSupervisor = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Find supervisor by email
    const user = await prisma.user.findUnique({
      where: {
        email,
        role: "SUPERVISOR"
      },
    });

    if (!user) {
      const error = new Error("Supervisor not found");
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
    if (user.role !== "SUPERVISOR") {
      const error = new Error(
        "Unauthorized access - must be a Supervisor"
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

    // Log the activity
    await prisma.userActivity.create({
      data: {
        ipAddress: req?.headers['x-client-ip'] || req?.ip || req?.headers['x-forwarded-for'] || 'Unknown',
        deviceId: req?.headers['x-device-id'] || 'Unknown',
        browserAgent: req?.headers['user-agent'] || 'Unknown',
        action: 'Login',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify({ role: user.role, timestamp: new Date().toISOString() }),
        userId: user.id
      }
    });

    // Return user data and token
    res.status(200).json({
      token,
      role: user.role,
      supervisor: {
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
export const getSupervisorProfile = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;

    const supervisor = req.user;

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      supervisor: {
        id: supervisor.id,
        name: supervisor.name,
        email: supervisor.email,
        role: supervisor.role,
        title: supervisor.title,
        phone: supervisor.phone,
        designation: supervisor.designation,
        loggedInAt: supervisor.loggedInAt,
        department: supervisor.department,
        createdAt: supervisor.createdAt,
        updatedAt: supervisor.updatedAt,
      },
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Update supervisor profile controller
export const updateSupervisorProfile = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const { name, phone, designation } = req.body;

    const updatedSupervisor = await prisma.user.update({
      where: { id: supervisorId },
      data: {
        name,
        phone,
        designation,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Profile updated successfully",
      supervisor: {
        id: updatedSupervisor.id,
        name: updatedSupervisor.name,
        email: updatedSupervisor.email,
        phone: updatedSupervisor.phone,
        designation: updatedSupervisor.designation,
        updatedAt: updatedSupervisor.updatedAt,
      },
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Change password controller
export const changePassword = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: supervisorId },
    });

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      const error = new Error("Current password is incorrect");
      error.statusCode = 400;
      throw error;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: supervisorId },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Logout controller
export const logoutSupervisor = async (req, res, next) => {
  try {
    // In a real application, you might want to blacklist the token
    // For now, we'll just return a success message
    res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get assigned students controller
export const getAssignedStudents = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const getSupervisor = await prisma.supervisor.findUnique({
      where: {
        userId: userId
      }
    })

    if (!getSupervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }
    const supervisorId = getSupervisor.id;

    const students = await prisma.student.findMany({
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
          where: {
            isCurrent: true
          },
          include: {
            definition: true,

          },
          orderBy: {
            startDate: 'desc',
          },
        },
        school: true,
        department: true,
        proposals: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
    });

    const documentRows = await prisma.studentDocument.findMany({
      where: {
        supervisorId: userId,
        type: { not: 'REVIEWED' },
      },
      select: {
        studentId: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

    const documentSummaryMap = {};
    for (const doc of documentRows) {
      const summary = documentSummaryMap[doc.studentId] || { total: 0, pending: 0, overdue: 0 };
      summary.total += 1;
      if (!doc.reviewedAt) {
        summary.pending += 1;
        if (now - new Date(doc.createdAt).getTime() > fourteenDaysMs) {
          summary.overdue += 1;
        }
      }
      documentSummaryMap[doc.studentId] = summary;
    }

    const studentsWithDocs = students.map((student) => ({
      ...student,
      documentSummary: documentSummaryMap[student.id] || { total: 0, pending: 0, overdue: 0 },
    }));

    res.status(200).json({
      students: studentsWithDocs,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get student details controller
export const getStudentDetails = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { studentId } = req.params;

    const getSupervisor = await prisma.supervisor.findUnique({
      where: {
        userId: userId
      }
    })

    if (!getSupervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }
    const supervisorId = getSupervisor.id;

    // Verify that the student is assigned to this supervisor
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        supervisors: {
          some: {
            id: supervisorId,
          },
        },
      },
      include: {
        statuses: {
          include: {
            definition: true,
          },
        },
        proposals: true,
        notifications: true,

        school: true,
        campus: true,
        department: true,


      },
    });

    if (!student) {
      const error = new Error("Student not found or not assigned to you");
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

// Update student progress controller
export const updateStudentProgress = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const { studentId } = req.params;
    const { status, comments } = req.body;

    // Verify that the student is assigned to this supervisor
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        supervisors: {
          some: {
            id: supervisorId,
          },
        },
      },
    });

    if (!student) {
      const error = new Error("Student not found or not assigned to you");
      error.statusCode = 404;
      throw error;
    }

    // Create status update
    const statusUpdate = await prisma.studentStatus.create({
      data: {
        studentId,
        status,
        comments,
        updatedBy: supervisorId,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Student progress updated successfully",
      statusUpdate,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get student proposals controller
export const getStudentProposals = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { studentId } = req.params;

    const getSupervisor = await prisma.supervisor.findUnique({
      where: {
        userId: userId
      }
    })

    if (!getSupervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }
    const supervisorId = getSupervisor.id;

    // Verify that the student is assigned to this supervisor
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        supervisors: {
          some: {
            id: supervisorId,
          },
        },
      },
    });

    if (!student) {
      const error = new Error("Student not found or not assigned to you");
      error.statusCode = 404;
      throw error;
    }

    const proposals = await prisma.proposal.findMany({
      where: {
        studentId,
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

    res.status(200).json({
      proposals,
    });
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
    const userId = req.user.id;


    const getSupervisor = await prisma.supervisor.findUnique({
      where: {
        userId: userId
      }
    })

    if (!getSupervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }
    const supervisorId = getSupervisor.id;

    // Get all proposals where the supervisor is assigned
    const proposals = await prisma.proposal.findMany({
      where: {
        student: {
          supervisors: {
            some: {
              id: supervisorId,
            },
          },
        },
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
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

// Review proposal controller
export const reviewProposal = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const { proposalId } = req.params;
    const { status, comments, feedback } = req.body;

    // Get proposal and verify student is assigned to supervisor
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        student: {
          supervisors: {
            some: {
              id: supervisorId,
            },
          },
        },
      },
      include: {
        student: true,
      },
    });

    if (!proposal) {
      const error = new Error("Proposal not found or not authorized");
      error.statusCode = 404;
      throw error;
    }

    // Update proposal status
    const updatedProposal = await prisma.proposal.update({
      where: {
        id: proposalId,
      },
      data: {
        status,
        supervisorComments: comments,
        supervisorFeedback: feedback,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      message: "Proposal reviewed successfully",
      proposal: updatedProposal,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Controller to get student statuses with update history, ensuring student is assigned to supervisor
export const getStudentStatuses = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const supervisorUserId = req.user.id;

    // Get supervisor record
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: supervisorUserId },
    });

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if student is assigned to this supervisor
    const student = await prisma.student.findUnique({
      where: {
        id: studentId, supervisors: {
          some: {
            id: supervisor?.id,
          },
        },
      },
      include: {
        supervisors: {
          where: { id: supervisor.id },
          select: { id: true },
        },
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

    if (!student.supervisors || student.supervisors.length === 0) {
      const error = new Error("You are not authorized to view this student's statuses");
      error.statusCode = 403;
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


/** Book management routes */
// Controller for getting student books
export const getStudentBooks = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const supervisorUserId = req.user.id;

    if (!studentId) {
      const error = new Error("Student ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Get supervisor record
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: supervisorUserId },
    });

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if student is assigned to this supervisor
    const student = await prisma.student.findUnique({
      where: {
        id: studentId, supervisors: {
          some: {
            id: supervisor?.id,
          },
        },
      },
      include: {
        supervisors: {
          where: { id: supervisor.id },
          select: { id: true },
        },
      },
    });

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    if (!student.supervisors || student.supervisors.length === 0) {
      const error = new Error("You are not authorized to view this student's books");
      error.statusCode = 403;
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

export const getAllBooks = async (req, res, next) => {
  try {
    // Get supervisor by user id
    const userId = req.user.id;
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId }
    });

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    // Get books where this supervisor is assigned
    const books = await prisma.book.findMany({
      where: {
        student: {
          supervisors: {
            some: {
              id: supervisor.id
            }
          }
        }
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
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



// Get dashboard stats controller
export const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;


    const getSupervisor = await prisma.supervisor.findUnique({
      where: {
        userId: userId
      }
    })

    if (!getSupervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }
    const supervisorId = getSupervisor.id;



    // Get assigned students count
    const assignedStudentsCount = await prisma.student.count({
      where: {
        supervisors: {
          some: {
            id: supervisorId,
          },
        },
      },
    });




    // Get students assigned to this supervisor
    const students = await prisma.student.findMany({
      where: {
        supervisors: {
          some: {
            id: supervisorId,
          },
        },
      },
      include: {
        statuses: {
          where: { isCurrent: true },
          include: { definition: true }
        }
      }
    });

    // Get all status definitions
    const statusDefinitions = await prisma.statusDefinition.findMany();

    // Map status name to count
    const statusMap = {};
    for (const def of statusDefinitions) {
      statusMap[def.name.toLowerCase().replace(/\s+/g, "")] = 0;
    }

    students.forEach(student => {
      const currentStatus = student.statuses?.[0]?.definition?.name;
      if (currentStatus) {
        const key = currentStatus.toLowerCase().replace(/\s+/g, "");
        if (statusMap.hasOwnProperty(key)) {
          statusMap[key]++;
        }
      }
    });

    // Extract specific status counts
    const workshop = statusMap.workshop || 0;
    const normalProgress = statusMap.normalprogress || 0;
    const underExamination = statusMap.underexamination || 0;

    res.status(200).json({
      stats: {
        assignedStudentsCount,
        workshop: workshop.toString(),
        normalProgress: normalProgress.toString(),
        underExamination: underExamination.toString(),
      },
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get notifications controller
export const getNotifications = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: supervisorId,
        recipientType: 'SUPERVISOR',
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20,
    });

    res.status(200).json({
      notifications,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// List all students for messaging
export const listAllStudentsForMessaging = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { supervisor: { include: { students: true } } }
    });

    if (!user || !user.supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }



    // Find students assigned to this supervisor
    const students = await prisma.studentUser.findMany({
      where: {
        role: 'STUDENT',

        student: {
          supervisors: {
            some: {
              id: user.supervisor.id
            }
          }
        }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      }
    });

    const mappedStudents = students.map(s => ({
      ...s,
      name: s.fullName
    }));



    res.status(200).json({ students: mappedStudents });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

// Controller for getting student status statistics for dashboard charts
export const getStatusStatistics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { category = "main" } = req.query;

    // Get supervisor record
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId: userId },
    });

    if (!supervisor) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    let whereCondition = {};
    let stats = [];

    // Define different category filters - only for students assigned to this supervisor
    if (category === "main") {
      whereCondition = {
        isCurrent: true,
        student: {
          supervisors: {
            some: {
              id: supervisor.id,
            },
          },
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
            supervisors: {
              some: {
                id: supervisor.id,
              },
            },
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
        isCurrent: true,
        book: {
          student: {
            supervisors: {
              some: {
                id: supervisor.id,
              },
            },
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
    // Student status colors
    "normal progress": "#22C55E",
    fieldwork: "#3B82F6",
    "under examination": "#EAB308",
    "scheduled for viva": "#EC4899",
    "results approved": "#14B8A6",
    "results sent to schools": "#8B5CF6",
    "results approved by senate": "#06B6D4",

    // Book/Dissertation status colors
    "book planning": "#F59E0B", // amber
    "book writing": "#3B82F6", // blue
    "dissertation submitted": "#23388F", // dark blue
    "book under review": "#EAB308", // yellow
    "final dissertation & compliance report received": "#10B981", // emerald

    // Proposal status colors
    "proposal received": "#6366F1", // indigo
    "proposal in review": "#8B5CF6", // violet
    "waiting for proposal defense": "#EC4899", // pink
    "compliance report submitted": "#06B6D4", // cyan
    "letter to field issued": "#10B981", // emerald
  };

  return colorMap[statusName.toLowerCase()] || "#6B7280"; // Default gray color
};

// ********** DOCUMENT MANAGEMENT CONTROLLERS **********

/**
 * Get student documents
 * @route GET /api/v1/supervisor/students/:studentId/documents
 * @access Private (Supervisor)
 */
export const getStudentDocuments = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const { studentId } = req.params;

    // Get student documents that are assigned to this supervisor
    const documents = await prisma.studentDocument.findMany({
      where: {
        studentId,
        supervisorId: supervisorId
      },
      omit: { fileData: true },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true
          }
        },
        uploadedByStudent: {
          select: {
            id: true,
            fullName: true
          }
        },
        student: {
          select: {
            id: true,
            fullName: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform documents to include review status
    const transformedDocuments = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      type: doc.type,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      uploadedAt: doc.createdAt,
      uploadedBy: doc.uploadedBy || (doc.uploadedByStudent ? { id: doc.uploadedByStudent.id, name: doc.uploadedByStudent.fullName } : null),
      isReviewed: !!doc.reviewedAt,
      reviewedAt: doc.reviewedAt,
      reviewedBy: doc.reviewedBy,
      reviewComments: doc.reviewComments
    }));

    res.status(200).json({
      message: "Student documents retrieved successfully",
      documents: transformedDocuments
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get pending reviews for dashboard
export const getPendingReviews = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const docs = await prisma.studentDocument.findMany({
      where: {
        supervisorId: userId,
        type: { not: 'REVIEWED' }
      },
      omit: { fileData: true },
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            registrationNumber: true
          }
        }
      }
    });

    const pending = docs.filter(doc => !doc.reviewedAt).slice(0, 10);

    const transformed = pending.map(doc => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      uploadedAt: doc.createdAt,
      student: doc.student
    }));

    res.json({ pendingReviews: transformed });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

/**
 * Download a student document
 * @route GET /api/v1/supervisor/documents/:documentId/download
 * @access Private (Supervisor)
 */
export const downloadStudentDocument = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const { documentId } = req.params;



    // Get document with student info
    const document = await prisma.studentDocument.findUnique({
      where: { id: documentId },
      include: {
        student: true
      }
    });

    if (!document) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      throw error;
    }



    // Verify supervisor has access to this document
    if (document.supervisorId !== supervisorId) {
      const error = new Error("Access denied - document not assigned to supervisor");
      error.statusCode = 403;
      throw error;
    }

    // Set response headers
    res.setHeader('Content-Type', document.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.setHeader('Content-Length', document.fileSize);





    if (document.fileGridFSId) {
      // New storage: stream from GridFS
      const stream = await openGridFSStream(document.fileGridFSId);
      stream.on('error', (error) => {
        console.log('Error streaming file from GridFS:', error.message);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to stream file' });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
      return;
    }

    // Legacy storage: file stored inline in the document
    if (!document.fileData) {
      const error = new Error('File data not found');
      error.statusCode = 404;
      throw error;
    }

    // Send file buffer - handle different data types
    if (Buffer.isBuffer(document.fileData)) {
      // If it's already a Buffer, send it directly
      res.send(document.fileData);
    } else if (document.fileData instanceof Uint8Array) {
      // If it's a Uint8Array, convert to Buffer
      res.send(Buffer.from(document.fileData));
    } else {
      // For other types, try to convert to Buffer
      res.send(Buffer.from(document.fileData));
    }

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * Upload reviewed document
 * @route POST /api/v1/supervisor/documents/:documentId/review
 * @access Private (Supervisor)
 */
export const uploadReviewedDocument = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const { documentId } = req.params;
    const { reviewComments, noDocument } = req.body;
    const file = req.file;

    const isNoDocument = noDocument === 'true';

    if (!isNoDocument && !file) {
      const error = new Error('No reviewed document uploaded');
      error.statusCode = 400;
      throw error;
    }

    // Get original document with student info
    const originalDocument = await prisma.studentDocument.findUnique({
      where: { id: documentId },
      include: {
        student: {
          include: {
            studentUser: true
          }
        }
      }
    });

    if (!originalDocument) {
      const error = new Error("Original document not found");
      error.statusCode = 404;
      throw error;
    }

    // Verify supervisor has access to this document
    if (originalDocument.supervisorId !== supervisorId) {
      const error = new Error("Access denied - document not assigned to supervisor");
      error.statusCode = 403;
      throw error;
    }

    // Upload file to GridFS before the transaction so the transaction stays fast
    let fileGridFSId = null;
    if (!isNoDocument) {
      const storedFileId = await storeFileToGridFS(file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
        metadata: {
          originalDocumentId: documentId,
          uploadedBy: supervisorId,
          originalname: file.originalname,
          documentType: 'REVIEWED'
        }
      });
      fileGridFSId = storedFileId.toString();
    }

    let reviewedDocument;
    try {
      ({ reviewedDocument } = await prisma.$transaction(async (tx) => {
        // Create reviewed document
        const newReviewedDoc = await tx.studentDocument.create({
          data: {
            title: `Reviewed: ${originalDocument.title}`,
            description: reviewComments || `Reviewed version of ${originalDocument.title}`,
            type: 'REVIEWED',
            fileName: isNoDocument ? null : file.originalname,
            fileType: isNoDocument ? null : file.mimetype,
            fileSize: isNoDocument ? null : file.size,
            fileData: null,
            fileGridFSId,
            student: {
              connect: { id: originalDocument.studentId }
            },
            supervisor: {
              connect: { id: supervisorId }
            },
            uploadedBy: {
              connect: { id: supervisorId }
            },
            reviewedBy: {
              connect: { id: supervisorId }
            },
            reviewedAt: new Date(),
            reviewComments: reviewComments
          }
        });

        // Update original document to mark as reviewed
        await tx.studentDocument.update({
          where: { id: documentId },
          data: {
            reviewedAt: new Date(),
            reviewedBy: {
              connect: { id: supervisorId }
            },
            reviewComments: reviewComments
          }
        });

        return { reviewedDocument: newReviewedDoc };
      }, {
        timeout: 30000
      }));
    } catch (error) {
      // Best-effort cleanup of the uploaded GridFS file if the transaction failed
      if (fileGridFSId) {
        try {
          await deleteFromGridFS(fileGridFSId);
        } catch (cleanupError) {
          console.log('GridFS cleanup failed:', cleanupError.message);
        }
      }
      throw error;
    }

    // Cancel the pending 14-day document review reminder, if any
    await notificationService.cancelDocumentReviewReminder(documentId);

    // Emit socket event to notify student in real-time (guarded so it can never fail the request)
    try {
      const io = req.app.get('io');
      const studentUserId = originalDocument.student?.studentUser?.id;
      if (io && studentUserId) {
        io.emitToUser(studentUserId, 'document_reviewed', {
          type: 'document_reviewed',
          document: {
            id: reviewedDocument.id,
            title: reviewedDocument.title,
            fileName: reviewedDocument.fileName,
            fileType: reviewedDocument.fileType,
            fileSize: reviewedDocument.fileSize,
            uploadedAt: reviewedDocument.createdAt,
            reviewedAt: reviewedDocument.reviewedAt,
            reviewComments: reviewComments
          }
        });
      }
    } catch (socketError) {
      console.error('Failed to emit socket event for document review:', socketError);
    }

    // Notify student via email
    try {
      if (originalDocument.student?.email) {
        const studentEmailHtml = `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #23388F;">Document Reviewed</h2>
                <p>Dear ${originalDocument.student.fullName},</p>
                <p>Your document <strong>"${originalDocument.title}"</strong> has been reviewed by your supervisor.</p>
                ${reviewComments ? `
                <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #23388F; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>Review Comments:</strong></p>
                  <p style="margin: 5px 0;">${reviewComments}</p>
                </div>` : ''}
                <p>Please log in to the DRIMS Student Portal to view the reviewed document and feedback.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #666;">This is an automated message from the DRIMS Research Management System.</p>
              </div>
            </body>
          </html>
        `;

        await emailService.sendEmail({
          to: originalDocument.student.email,
          subject: `DRIMS:Document Reviewed - ${originalDocument.title}`,
          htmlContent: studentEmailHtml,
          textContent: `Dear ${originalDocument.student.fullName}, your document "${originalDocument.title}" has been reviewed by your supervisor.${reviewComments ? `\n\nReview Comments:\n${reviewComments}` : ''}\n\nPlease log in to the DRIMS Student Portal to view the reviewed document and feedback.`
        });
        console.log('Review notification email sent to student:', originalDocument.student.email);
      }
    } catch (emailError) {
      console.error('Failed to send review notification to student:', emailError);
    }

    res.status(201).json({
      message: isNoDocument ? 'Review comments submitted successfully' : 'Reviewed document uploaded successfully',
      document: {
        id: reviewedDocument.id,
        title: reviewedDocument.title,
        type: reviewedDocument.type,
        fileName: reviewedDocument.fileName,
        uploadedAt: reviewedDocument.createdAt,
        reviewedAt: reviewedDocument.reviewedAt
      }
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * @desc    Delete a reviewed document uploaded by the supervisor
 * @route   DELETE /api/v1/supervisor/documents/:documentId/review/:reviewId
 * @access  Private (Supervisor)
 */
export const deleteReviewedDocument = async (req, res, next) => {
  try {
    const supervisorId = req.user.id;
    const { documentId, reviewId } = req.params;

    // Get the reviewed document
    const reviewDocument = await prisma.studentDocument.findFirst({
      where: { id: reviewId }
    });

    if (!reviewDocument || reviewDocument.type !== 'REVIEWED') {
      const error = new Error("Reviewed document not found");
      error.statusCode = 404;
      throw error;
    }

    // Only the supervisor who uploaded this review can delete it
    if (reviewDocument.reviewedById !== supervisorId) {
      const error = new Error("Access denied - you can only delete reviews you uploaded");
      error.statusCode = 403;
      throw error;
    }

    // Get the original document and verify the review belongs to it
    const originalDocument = await prisma.studentDocument.findFirst({
      where: { id: documentId },
      include: {
        student: {
          include: {
            studentUser: true
          }
        }
      }
    });

    if (!originalDocument) {
      const error = new Error("Original document not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      originalDocument.studentId !== reviewDocument.studentId ||
      originalDocument.title !== reviewDocument.title.replace(/^Reviewed: /, '')
    ) {
      const error = new Error("Reviewed document does not match the original document");
      error.statusCode = 400;
      throw error;
    }

    let reverted = false;

    await prisma.$transaction(async (tx) => {
      await tx.studentDocument.delete({
        where: { id: reviewId }
      });

      // Count remaining reviews linked to the original document
      const remainingReviews = await tx.studentDocument.count({
        where: {
          studentId: originalDocument.studentId,
          type: 'REVIEWED',
          title: reviewDocument.title
        }
      });

      // Revert to unreviewed if this was the only review
      if (remainingReviews === 0) {
        await tx.studentDocument.update({
          where: { id: documentId },
          data: {
            reviewedAt: null,
            reviewedById: null,
            reviewComments: null
          }
        });
        reverted = true;
      }
    }, {
      timeout: 30000
    });

    // Best-effort cleanup of the GridFS file (comments-only reviews have no file)
    if (reviewDocument.fileGridFSId && reviewDocument.fileName) {
      try {
        await deleteFromGridFS(reviewDocument.fileGridFSId);
      } catch (cleanupError) {
        console.error('GridFS cleanup failed after review deletion:', cleanupError.message);
      }
    }

    // Re-schedule the 14-day review reminder if the document reverted to unreviewed
    if (reverted) {
      try {
        const supervisor = await prisma.supervisor.findUnique({
          where: { userId: supervisorId }
        });

        if (supervisor) {
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + 14);

          await notificationService.scheduleNotification({
            type: 'REMINDER',
            statusType: 'PENDING',
            title: 'DRIMS: Document Review Reminder',
            message: `This is a reminder to review the document "${originalDocument.title}". It has been 14 days since the previous review was removed.`,
            recipientCategory: 'SUPERVISOR',
            recipientId: supervisor.id,
            scheduledFor: scheduledDate,
            metadata: {
              documentId: documentId,
              additionalContent: `<p>A document submitted by your student is waiting for your review.</p>
                                  <p><strong>Document:</strong> ${originalDocument.title}</p>`
            }
          });
          console.log('Re-scheduled 14-day review reminder for document:', documentId);
        }
      } catch (reminderError) {
        console.error('Failed to re-schedule document review reminder:', reminderError);
      }
    }

    // Emit socket event to notify the student in real-time (guarded so it can never fail the request)
    try {
      const io = req.app.get('io');
      const studentUserId = originalDocument.student?.studentUser?.id;
      if (io && studentUserId) {
        io.emitToUser(studentUserId, 'document_deleted', {
          type: 'document_deleted',
          documentId: reviewId,
          originalDocumentId: documentId,
          studentId: originalDocument.studentId,
          reverted
        });
      }
    } catch (socketError) {
      console.error('Failed to emit socket event for review deletion:', socketError);
    }

    res.status(200).json({
      message: reverted ? 'Reviewed document deleted. Document is now pending review again.' : 'Reviewed document deleted successfully.',
      reverted
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// ==================== GUIDELINES ====================

/**
 * @desc    Create a new guideline document
 * @route   POST /api/v1/supervisor/guidelines
 * @access  Private (Supervisor)
 */
export const createGuideline = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, description, comments } = req.body;
    const file = req.file;

    if (!file) {
      const error = new Error('No file uploaded');
      error.statusCode = 400;
      throw error;
    }

    if (!title) {
      const error = new Error('Title is required');
      error.statusCode = 400;
      throw error;
    }

    // Find the supervisor record
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId }
    });

    if (!supervisor) {
      const error = new Error('Supervisor profile not found');
      error.statusCode = 404;
      throw error;
    }

    // Upload file to GridFS instead of storing inline in MongoDB
    const storedFileId = await storeFileToGridFS(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      metadata: {
        uploadedBy: userId,
        originalname: file.originalname,
        documentType: 'GUIDELINE'
      }
    });

    let guideline;
    try {
      guideline = await prisma.guideline.create({
        data: {
          title,
          description: description || null,
          comments: comments || null,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          fileData: null,
          fileGridFSId: storedFileId.toString(),
          supervisorId: supervisor.id
        },
        select: {
          id: true,
          title: true,
          description: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          comments: true,
          createdAt: true
        }
      });
    } catch (error) {
      try {
        await deleteFromGridFS(storedFileId);
      } catch (cleanupError) {
        console.log('GridFS cleanup failed:', cleanupError.message);
      }
      throw error;
    }

    res.status(201).json({
      message: 'Guideline created successfully',
      guideline
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * @desc    Get all guidelines created by this supervisor
 * @route   GET /api/v1/supervisor/guidelines
 * @access  Private (Supervisor)
 */
export const getSupervisorGuidelines = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId }
    });

    if (!supervisor) {
      const error = new Error('Supervisor profile not found');
      error.statusCode = 404;
      throw error;
    }

    const guidelines = await prisma.guideline.findMany({
      where: { supervisorId: supervisor.id },
      select: {
        id: true,
        title: true,
        description: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        comments: true,
        createdAt: true,
        recipients: {
          select: {
            id: true,
            sharedAt: true,
            viewedAt: true,
            student: {
              select: {
                id: true,
                fullName: true,
                registrationNumber: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ guidelines });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * @desc    Download a guideline file
 * @route   GET /api/v1/supervisor/guidelines/:guidelineId/download
 * @access  Private (Supervisor)
 */
export const downloadGuideline = async (req, res, next) => {
  try {
    const { guidelineId } = req.params;
    const userId = req.user.id;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId }
    });

    if (!supervisor) {
      const error = new Error('Supervisor profile not found');
      error.statusCode = 404;
      throw error;
    }

    const guideline = await prisma.guideline.findUnique({
      where: { id: guidelineId }
    });

    if (!guideline) {
      const error = new Error('Guideline not found');
      error.statusCode = 404;
      throw error;
    }

    if (guideline.supervisorId !== supervisor.id) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    res.set({
      'Content-Type': guideline.fileType,
      'Content-Disposition': `attachment; filename="${guideline.fileName}"`
    });

    if (guideline.fileGridFSId) {
      // New storage: stream from GridFS
      const stream = await openGridFSStream(guideline.fileGridFSId);
      stream.on('error', (error) => {
        console.log('Error streaming guideline from GridFS:', error.message);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to stream file' });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
      return;
    }

    // Legacy storage: file stored inline in the document
    if (!guideline.fileData) {
      const error = new Error('File data not found');
      error.statusCode = 404;
      throw error;
    }

    res.send(Buffer.from(guideline.fileData));
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * @desc    Add or update comments on a guideline
 * @route   POST /api/v1/supervisor/guidelines/:guidelineId/comments
 * @access  Private (Supervisor)
 */
export const addGuidelineComment = async (req, res, next) => {
  try {
    const { guidelineId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId }
    });

    if (!supervisor) {
      const error = new Error('Supervisor profile not found');
      error.statusCode = 404;
      throw error;
    }

    const guideline = await prisma.guideline.findUnique({
      where: { id: guidelineId }
    });

    if (!guideline) {
      const error = new Error('Guideline not found');
      error.statusCode = 404;
      throw error;
    }

    if (guideline.supervisorId !== supervisor.id) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    const updated = await prisma.guideline.update({
      where: { id: guidelineId },
      data: { comments },
      select: {
        id: true,
        title: true,
        comments: true,
        updatedAt: true
      }
    });

    res.status(200).json({
      message: 'Comments updated successfully',
      guideline: updated
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * @desc    Share a guideline with students
 * @route   POST /api/v1/supervisor/guidelines/:guidelineId/share
 * @access  Private (Supervisor)
 */
export const shareGuideline = async (req, res, next) => {
  try {
    const { guidelineId } = req.params;
    const { studentIds, shareWithAll } = req.body;
    const userId = req.user.id;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId }
    });

    if (!supervisor) {
      const error = new Error('Supervisor profile not found');
      error.statusCode = 404;
      throw error;
    }

    const guideline = await prisma.guideline.findUnique({
      where: { id: guidelineId }
    });

    if (!guideline) {
      const error = new Error('Guideline not found');
      error.statusCode = 404;
      throw error;
    }

    if (guideline.supervisorId !== supervisor.id) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    // Determine which students to share with
    let targetStudentIds = [];

    if (shareWithAll) {
      // Get all assigned students who don't already have this guideline
      const existingRecipients = await prisma.guidelineRecipient.findMany({
        where: { guidelineId },
        select: { studentId: true }
      });
      const existingIds = new Set(existingRecipients.map(r => r.studentId));

      targetStudentIds = supervisor.studentIds.filter(id => !existingIds.has(id));
    } else if (studentIds && Array.isArray(studentIds)) {
      // Filter out students who already have this guideline
      const existingRecipients = await prisma.guidelineRecipient.findMany({
        where: { guidelineId },
        select: { studentId: true }
      });
      const existingIds = new Set(existingRecipients.map(r => r.studentId));

      targetStudentIds = studentIds.filter(id => !existingIds.has(id));
    }

    if (targetStudentIds.length === 0) {
      return res.status(200).json({
        message: 'No new students to share with',
        sharedCount: 0
      });
    }

    // Create recipient records
    const recipientData = targetStudentIds.map(studentId => ({
      guidelineId,
      studentId
    }));

    await prisma.guidelineRecipient.createMany({
      data: recipientData
    });

    // Fetch student details for notifications
    const students = await prisma.student.findMany({
      where: { id: { in: targetStudentIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        studentUserId: true
      }
    });

    // Create notifications for each student
    const notificationPromises = students.map(student => {
      return prisma.notification.create({
        data: {
          type: 'SYSTEM',
          statusType: 'SENT',
          title: 'New Guidelines Shared',
          message: `${supervisor.name} has shared guidelines document "${guideline.title}" with you`,
          recipientCategory: 'STUDENT',
          recipientEmail: student.email,
          recipientName: student.fullName,
          scheduledFor: new Date(),
          sentAt: new Date(),
          studentId: student.id,
          metadata: {
            guidelineId,
            guidelineTitle: guideline.title,
            supervisorName: supervisor.name
          }
        }
      });
    });

    await Promise.allSettled(notificationPromises);

    res.status(200).json({
      message: `Guideline shared with ${targetStudentIds.length} student(s)`,
      sharedCount: targetStudentIds.length
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

/**
 * @desc    Get recipients of a guideline
 * @route   GET /api/v1/supervisor/guidelines/:guidelineId/recipients
 * @access  Private (Supervisor)
 */
export const getGuidelineRecipients = async (req, res, next) => {
  try {
    const { guidelineId } = req.params;
    const userId = req.user.id;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId }
    });

    if (!supervisor) {
      const error = new Error('Supervisor profile not found');
      error.statusCode = 404;
      throw error;
    }

    const guideline = await prisma.guideline.findUnique({
      where: { id: guidelineId }
    });

    if (!guideline) {
      const error = new Error('Guideline not found');
      error.statusCode = 404;
      throw error;
    }

    if (guideline.supervisorId !== supervisor.id) {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }

    const recipients = await prisma.guidelineRecipient.findMany({
      where: { guidelineId },
      select: {
        id: true,
        sharedAt: true,
        viewedAt: true,
        student: {
          select: {
            id: true,
            fullName: true,
            registrationNumber: true,
            email: true
          }
        }
      },
      orderBy: { sharedAt: 'desc' }
    });

    res.status(200).json({ recipients });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};