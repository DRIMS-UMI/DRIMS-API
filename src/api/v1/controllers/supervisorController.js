import prisma from "../../../utils/db.mjs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { notificationService } from "../../../services/notificationService.js";

//Supervisor login Controller
export const loginSupervisor = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Find supervisor by email
    const user = await prisma.user.findUnique({
      where: { email,
        role: "SUPERVISOR"
       },
    });

    if (!user) {
      const error = new Error("Supervisor not found");
      error.statusCode = 404;
      throw error;
    }

    console.log("users", user)

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
    console.log("logged in")

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const error = new Error("Invalid password");
      error.statusCode = 401;
      throw error;
    }

    console.log("password is valid")

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
      where: { id: studentId,   supervisors: {
        some: {
          id: supervisor?.id,
        },
      }, },
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
      where: { id: studentId, supervisors: {
        some: {
          id: supervisor?.id,
        },
      }, },
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

    console.log("getSupervisor", getSupervisor)

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

    console.log("user", user)

    // Find students assigned to this supervisor
    const students = await prisma.user.findMany({
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
        name: true,
        email: true,
        role: true,
        title: true,
        
      }
    });

    console.log("students", students)

    res.status(200).json({ students });
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