import prisma from "../../../utils/db.mjs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { notificationService } from "../../../services/notificationService.js";

// Student login controller
export const loginStudent = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Find student by email
    const user = await prisma.user.findUnique({
      where: { 
        email,
        role: "STUDENT"
      },
    });

    if (!user) {
      const error = new Error("Student not found");
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
    if (user.role !== "STUDENT") {
      const error = new Error(
        "Unauthorized access - must be a Student"
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

    // Get student details
    const student = await prisma.student.findUnique({
      where: { email },
      include: {
        statuses: {
          where: { isCurrent: true },
          include: { definition: true }
        },
        supervisors: true,
        school: true,
        campus: true,
        department: true
      }
    });

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
        studentId: student?.id
      },
      process.env.AUTH_SECRET,
      { expiresIn: rememberMe ? "30d" : "24h" }
    );

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        title: user.title,
        email: user.email,
        name: user.name,
        role: user.role,
        designation: user.designation,
        phone: user.phone,
        student: student
      },
      token
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get logged in user information
export const getLoggedInUser = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user with basic student information
    const user = await prisma.user.findUnique({
      where: { id: userId },
     
    });

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Logged in user information retrieved successfully",
      user: {
        id: user.id,
        title: user.title,
        email: user.email,
        name: user.name,
        role: user.role,
        designation: user.designation,
        phone: user.phone,
       
        
      }
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get student profile
export const getStudentProfile = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        statuses: {
          
          include: { definition: true },
          
        },
        supervisors: true,
        school: true,
        campus: true,
        department: true,
        proposals: {
          include: {
            defenses: true,
            
          }
        },
        books: {
          include: {
            vivaHistory: true,
            examinerAssignments: {
              include: {
                examiner: true
              }
            }
          }
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Student profile retrieved successfully",
      student
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get student statuses
export const getStudentStatuses = async (req, res, next) => {
  try {
    const userId = req.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });

    console.log(user);

    if (!user || !user.student) {
      const error = new Error("Student not found for this user");
      error.statusCode = 404;
      throw error;
    }

    const studentId = user.student.id;
    // Check if student exists and get their statuses
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

// Get student proposals
export const getStudentProposals = async (req, res, next) => {
  try {
    const userId = req.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });

    if (!user || !user.student) {
      const error = new Error("Student not found for this user");
      error.statusCode = 404;
      throw error;
    }

    const studentId = user.student.id;
    // Check if student exists and get their proposals
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

   

    res.status(200).json({
      proposals: proposals,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get student books
export const getStudentBooks = async (req, res, next) => {
  try {
    const userId = req.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });

    if (!user || !user.student) { 
      const error = new Error("Student not found for this user");
      error.statusCode = 404;
      throw error;
    }

    const studentId = user.student.id;

    // Check if student exists and get their books
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
      books,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Update student profile
export const updateStudentProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // First, get the user to find the associated student id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });

    if (!user || !user.student) {
      const error = new Error("Student not found for this user");
      error.statusCode = 404;
      throw error;
    }

    const studentId = user.student.id;

    // Remove sensitive fields that shouldn't be updated
    const { id, email, role, password, ...safeUpdateData } = updateData;

    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: safeUpdateData,
      include: {
        statuses: {
          where: { isCurrent: true },
          include: { definition: true }
        },
        supervisors: true,
        school: true,
        campus: true,
        department: true
      }
    });

    res.status(200).json({
      message: "Student profile updated successfully",
      student: updatedStudent
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Change student password
export const changeStudentPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId }
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
      error.statusCode = 401;
      throw error;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.status(200).json({
      message: "Password changed successfully"
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get student dashboard stats
export const getStudentDashboardStats = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;

    // Get student with all related data
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        statuses: {
          where: { isCurrent: true },
          include: { definition: true }
        },
        proposals: {
          include: {
            defenses: true
          }
        },
        books: {
          include: {
            vivaHistory: true,
            examinerAssignments: {
              include: {
                examiner: true
              }
            }
          }
        },
        notifications: {
          where: { isRead: false },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!student) {
      const error = new Error("Student not found");
      error.statusCode = 404;
      throw error;
    }

    // Calculate stats
    const stats = {
      currentStatus: student.statuses[0]?.definition?.name || "No Status",
      totalProposals: student.proposals.length,
      completedProposals: student.proposals.filter(p => 
        p.defenses?.some(d => d.isCurrent && d.verdict)
      ).length,
      pendingProposals: student.proposals.filter(p => 
        !p.defenses?.some(d => d.isCurrent && d.verdict)
      ).length,
      totalBooks: student.books.length,
      completedBooks: student.books.filter(b => 
        b.vivaHistory?.some(v => v.isCurrent)
      ).length,
      pendingBooks: student.books.filter(b => 
        !b.vivaHistory?.some(v => v.isCurrent)
      ).length,
      unreadNotifications: student.notifications.length,
      supervisors: student.supervisors?.length || 0
    };

    res.status(200).json({
      message: "Dashboard stats retrieved successfully",
      stats
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get student notifications
export const getStudentNotifications = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const { page = 1, limit = 20 } = req.query;

    const notifications = await prisma.notification.findMany({
      where: { 
        studentId,
        isRead: false
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.notification.count({
      where: { 
        studentId,
        isRead: false
      }
    });

    res.status(200).json({
      message: "Notifications retrieved successfully",
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const studentId = req.user.studentId;

    await prisma.notification.update({
      where: { 
        id: notificationId,
        studentId
      },
      data: { isRead: true }
    });

    res.status(200).json({
      message: "Notification marked as read"
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Logout student
export const logoutStudent = async (req, res, next) => {
  try {
    // In a real application, you might want to invalidate the token
    // For now, we'll just return a success message
    res.status(200).json({
      message: "Logged out successfully"
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Research Request Controllers

// Get all research requests for a student
export const getStudentResearchRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });

    const requests = await prisma.researchRequest.findMany({
      where: { studentId: user.student.id },
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

    // Calculate stats
    const stats = {
      requested: requests.length,
      pending: requests.filter(r => r.status === 'PENDING').length,
      beingProcessed: requests.filter(r => r.status === 'BEING_PROCESSED').length,
      concluded: requests.filter(r => r.status === 'CONCLUDED').length,
    };

    res.status(200).json({
      message: "Research requests retrieved successfully",
      requests,
      stats
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Create a new research request
export const createResearchRequest = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { requestType, formData } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });

    if (!user || !user.student) {
      const error = new Error("Student not found for this user");
      error.statusCode = 404;
      throw error;
    }

    const studentId = user.student.id;

    // If requestType is 'Other', use formData.otherTitle as the requestType
    if (requestType === 'Other' && formData && formData.otherTitle) {
      requestType = formData.otherTitle;
    }

    // Validate required fields
    if (!requestType) {
      const error = new Error("Request type is required");
      error.statusCode = 400;
      throw error;
    }

    // Create the research request
    const researchRequest = await prisma.researchRequest.create({
      data: {
        studentId,
        requestType,
        formData: formData || {},
        status: 'PENDING',
        submittedAt: new Date()
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

    // Create notification for supervisors/admins
    // await notificationService.createNotification({
    //   type: 'SYSTEM',
    //   title: 'New Research Request',
    //   message: `Student ${researchRequest.student.firstName} ${researchRequest.student.lastName} has submitted a new ${requestType} request.`,
    //   recipientType: 'SUPERVISOR',
    //   recipientIds: researchRequest.student.supervisorIds || [],
    //   relatedEntityType: 'RESEARCH_REQUEST',
    //   relatedEntityId: researchRequest.id
    // });

    res.status(201).json({
      message: "Research request submitted successfully",
      request: researchRequest
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// Get a specific research request
export const getResearchRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });

    if (!user || !user.student) {
      const error = new Error("Student not found for this user");
      error.statusCode = 404;
      throw error;
    }

    const studentId = user.student.id;

    const request = await prisma.researchRequest.findFirst({
      where: {
        id: requestId,
        studentId
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

    if (!request) {
      const error = new Error("Research request not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Research request retrieved successfully",
      request
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
}; 

// List all supervisors for messaging
export const listAllSupervisorsForMessaging = async (req, res, next) => {
  try {
    // Get the current user (student)
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: { include: { supervisors: true } } }
    });

    if (!user || !user.student) {
      const error = new Error("Student not found for this user");
      error.statusCode = 404;
      throw error;
    }

    // Get supervisor userIds from the student's supervisors relation
    // Assuming student.supervisors is an array of supervisor objects with a userId field
    const supervisorUserIds = user.student.supervisors.map(sup => sup.userId);

    if (!supervisorUserIds || supervisorUserIds.length === 0) {
      return res.status(200).json({ supervisors: [] });
    }

    // Get user details for each supervisor
    const supervisors = await prisma.user.findMany({
      where: { id: { in: supervisorUserIds }, role: 'SUPERVISOR' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        title: true,
        
      }
    });

    res.status(200).json({ supervisors });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
}; 