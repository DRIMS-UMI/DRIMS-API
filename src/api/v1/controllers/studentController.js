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
    const userId = req.user.id;

    // Get user with student information
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

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        statuses: {
          include: { definition: true },
          orderBy: { startDate: 'desc' }
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
    const userId = req.user.id;

    // Get user with student information
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
          orderBy: { createdAt: 'desc' }
        },
        supervisors: true
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
      totalNotifications: student.notifications.length,
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
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Get user with student information
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

    const notifications = await prisma.notification.findMany({
      where: { 
        studentId
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    const total = await prisma.notification.count({
      where: { 
        studentId
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
    const userId = req.user.id;

    // Get user with student information
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

    // For now, we'll just verify the notification exists and belongs to the student
    const notification = await prisma.notification.findFirst({
      where: { 
        id: notificationId,
        studentId
      }
    });

    if (!notification) {
      const error = new Error("Notification not found");
      error.statusCode = 404;
      throw error;
    }

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

// Get available evaluations for student (POST_PROPOSAL_DEFENSE and POST_VIVA)
export const getAvailableEvaluations = async (req, res, next) => {
    try {
        const studentId = req.user.studentId;

        if (!studentId) {
            const error = new Error('Student ID not found');
            error.statusCode = 400;
            throw error;
        }

        // Get student with current status and evaluations
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                statuses: {
                    where: { isCurrent: true },
                    include: { definition: true }
                },
                evaluations: true,
                proposals: {
                    include: {
                        defenses: {
                            where: { isCurrent: true }
                        }
                    }
                },
                books: {
                    include: {
                        vivaHistory: {
                            where: { isCurrent: true }
                        }
                    }
                }
            }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        const currentStatus = student.statuses[0]?.definition?.name;
        const availableEvaluations = [];

        // Check if student is eligible for POST_PROPOSAL_DEFENSE evaluation
        const proposalDefenseStatuses = [
            'passed-proposal graded',
            'compliance report submitted',
            'letter to field issued',
            'fieldwork',
            'dissertation submitted'
        ];

        const hasCompletedProposalDefense = proposalDefenseStatuses.includes(currentStatus) ||
            student.proposals.some(proposal => 
                proposal.defenses.some(defense => 
                    defense.verdict && defense.verdict.includes('PASS')
                )
            );

        const hasPostProposalEvaluation = student.evaluations.some(
            evaluation => evaluation.trigger === 'POST_PROPOSAL_DEFENSE'
        );

        if (hasCompletedProposalDefense && !hasPostProposalEvaluation) {
            availableEvaluations.push({
                trigger: 'POST_PROPOSAL_DEFENSE',
                title: 'Post-Proposal Defense Evaluation',
                description: 'Evaluate your satisfaction with research training, supervision, and proposal defense process'
            });
        }

        // Check if student is eligible for POST_VIVA evaluation
        const postVivaStatuses = [
            'minutes pending',
            'compliance report submitted',
            'results approved',
            'results sent to schools',
            'results approved by senate',
            'graduated'
        ];

        const hasCompletedViva = postVivaStatuses.includes(currentStatus) ||
            student.books.some(book => 
                book.vivaHistory.some(viva => 
                    viva.verdict && (viva.verdict.includes('PASS') || viva.status === 'COMPLETED')
                )
            );

        const hasPostVivaEvaluation = student.evaluations.some(
            evaluation => evaluation.trigger === 'POST_VIVA'
        );

        if (hasCompletedViva && !hasPostVivaEvaluation) {
            availableEvaluations.push({
                trigger: 'POST_VIVA',
                title: 'Post-Viva Evaluation',
                description: 'Evaluate your satisfaction with the entire research process including dissertation examination'
            });
        }

        res.status(200).json({
            message: 'Available evaluations retrieved successfully',
            evaluations: availableEvaluations,
            currentStatus: currentStatus
        });

    } catch (error) {
        console.error('Error in getAvailableEvaluations:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Submit student evaluation
export const submitStudentEvaluation = async (req, res, next) => {
    try {
        const studentId = req.user.studentId;
        const {
            trigger,
            researchTrainingSatisfaction,
            supervisionSatisfaction,
            proposalDefenseSatisfaction,
            dissertationExaminationSatisfaction,
            researchTrainingComments,
            supervisionComments,
            proposalDefenseComments,
            dissertationExaminationComments,
            overallComments,
            suggestions
        } = req.body;

        if (!studentId) {
            const error = new Error('Student ID not found');
            error.statusCode = 400;
            throw error;
        }

        // Validate required fields
        if (!trigger || !researchTrainingSatisfaction || !supervisionSatisfaction || !proposalDefenseSatisfaction) {
            const error = new Error('Trigger and basic satisfaction ratings are required');
            error.statusCode = 400;
            throw error;
        }

        // Validate trigger
        if (!['POST_PROPOSAL_DEFENSE', 'POST_VIVA'].includes(trigger)) {
            const error = new Error('Invalid evaluation trigger');
            error.statusCode = 400;
            throw error;
        }

        // For POST_VIVA evaluations, dissertation examination satisfaction is required
        if (trigger === 'POST_VIVA' && !dissertationExaminationSatisfaction) {
            const error = new Error('Dissertation examination satisfaction is required for post-viva evaluations');
            error.statusCode = 400;
            throw error;
        }

        // Check if evaluation already exists
        const existingEvaluation = await prisma.studentEvaluation.findFirst({
            where: {
                studentId: studentId,
                trigger: trigger
            }
        });

        if (existingEvaluation) {
            const error = new Error('Evaluation for this trigger already exists');
            error.statusCode = 409;
            throw error;
        }

        // Create the evaluation
        const evaluation = await prisma.studentEvaluation.create({
            data: {
                student: { connect: { id: studentId } },
                trigger,
                researchTrainingSatisfaction,
                supervisionSatisfaction,
                proposalDefenseSatisfaction,
                dissertationExaminationSatisfaction: trigger === 'POST_VIVA' ? dissertationExaminationSatisfaction : null,
                researchTrainingComments,
                supervisionComments,
                proposalDefenseComments,
                dissertationExaminationComments: trigger === 'POST_VIVA' ? dissertationExaminationComments : null,
                overallComments,
                suggestions,
                isCompleted: true,
                submittedAt: new Date()
            }
        });

        res.status(201).json({
            message: 'Evaluation submitted successfully',
            evaluation
        });

    } catch (error) {
        console.error('Error in submitStudentEvaluation:', error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Get student's completed evaluations
export const getStudentEvaluations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user with student information
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

    // Get student evaluations
    const evaluations = await prisma.studentEvaluation.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
      message: "Student evaluations retrieved successfully",
      evaluations
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
};

// ********** DOCUMENT MANAGEMENT CONTROLLERS **********

/**
 * Upload a document
 * @route POST /api/v1/student/documents
 * @access Private (Student)
 */
export const uploadDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { documentType, title, description, supervisorId } = req.body;
    const file = req.file;

    if (!file) {
      const error = new Error('No file uploaded');
      error.statusCode = 400;
      throw error;
    }

    if (!documentType || !title || !supervisorId) {
      const error = new Error('Document type, title, and supervisor are required');
      error.statusCode = 400;
      throw error;
    }

    // Get user with student information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { student: true }
    });

    if (!user || !user.student) {
      const error = new Error("Student not found for this user");
      error.statusCode = 404;
      throw error;
    }

    // Verify that the supervisor is assigned to this student
    const student = await prisma.student.findUnique({
      where: { id: user.student.id },
      include: { supervisors: true }
    });

    const isSupervisorAssigned = student.supervisors.some(sup => sup.userId === supervisorId);
    if (!isSupervisorAssigned) {
      const error = new Error('Selected supervisor is not assigned to you');
      error.statusCode = 403;
      throw error;
    }

    // Create document record
    const document = await prisma.studentDocument.create({
      data: {
        title,
        description: description || null,
        type: documentType,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        fileData: file.buffer,
        student: {
          connect: { id: user.student.id }
        },
        uploadedBy: {
          connect: { id: userId }
        },
        supervisor: {
          connect: { id: supervisorId }
        }
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true
          }
        },
        supervisor: {
          select: {
            id: true,
            name: true,
            title: true
          }
        }
      }
    });

    console.log('Document uploaded successfully:', {
      id: document.id,
      title: document.title,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      hasFileData: !!document.fileData,
      fileDataType: typeof document.fileData,
      fileDataIsBuffer: Buffer.isBuffer(document.fileData),
      fileDataLength: document.fileData?.length,
      fileDataFirstBytes: document.fileData ? Array.from(document.fileData.slice(0, 10)) : null
    });

    // Emit socket event to notify supervisor in real-time
    const io = req.app.get('io');
    console.log('Socket IO instance available:', !!io);
    if (io) {
      const documentData = {
        id: document.id,
        title: document.title,
        description: document.description,
        type: document.type,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        uploadedAt: document.createdAt,
        uploadedBy: document.uploadedBy,
        supervisor: document.supervisor,
        studentId: user.student.id,
        studentName: `${user.student.firstName} ${user.student.lastName}`
      };

      console.log('Emitting socket events for document upload...');
      console.log('Emitting to supervisor:', supervisorId);
      console.log('Emitting to student:', userId);

      // Emit to the supervisor
      const supervisorEmitted = io.emitToUser(supervisorId, 'new_document_uploaded', {
        type: 'new_document_uploaded',
        document: documentData
      });
      console.log('Supervisor event emitted:', supervisorEmitted);

      // Also emit to the student for immediate UI update
      const studentEmitted = io.emitToUser(userId, 'document_upload_success', {
        type: 'document_upload_success',
        document: documentData
      });
      console.log('Student event emitted:', studentEmitted);
    } else {
      console.log('Socket IO instance not available');
    }

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        title: document.title,
        type: document.type,
        fileName: document.fileName,
        uploadedAt: document.createdAt
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
 * Get student documents
 * @route GET /api/v1/student/documents
 * @access Private (Student)
 */
export const getStudentDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user with student information
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

    // Get student documents
    const documents = await prisma.studentDocument.findMany({
      where: { studentId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            name: true
          }
        },
        supervisor: {
          select: {
            id: true,
            name: true,
            title: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform documents to include review status and supervisor info
    const transformedDocuments = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      type: doc.type,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      uploadedAt: doc.createdAt,
      uploadedBy: doc.uploadedBy,
      isReviewed: !!doc.reviewedAt,
      reviewedAt: doc.reviewedAt,
      reviewedBy: doc.reviewedBy,
      reviewComments: doc.reviewComments,
      supervisor: doc.supervisor
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

/**
 * Download a document
 * @route GET /api/v1/student/documents/:documentId/download
 * @access Private (Student)
 */
export const downloadDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    // Get user with student information
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

    // Get document
    const document = await prisma.studentDocument.findFirst({
      where: {
        id: documentId,
        studentId
      }
    });

    if (!document) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      throw error;
    }

    // Set response headers
    res.setHeader('Content-Type', document.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.setHeader('Content-Length', document.fileSize);

    console.log('Download file data info:', {
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      dataType: typeof document.fileData,
      dataIsBuffer: Buffer.isBuffer(document.fileData),
      dataIsUint8Array: document.fileData instanceof Uint8Array,
      dataLength: document.fileData?.length,
      dataFirstBytes: document.fileData ? Array.from(document.fileData.slice(0, 10)) : null
    });

    // Send file buffer - handle different data types
    if (Buffer.isBuffer(document.fileData)) {
      // If it's already a Buffer, send it directly
      console.log('Sending as Buffer');
      res.send(document.fileData);
    } else if (document.fileData instanceof Uint8Array) {
      // If it's a Uint8Array, convert to Buffer
      console.log('Converting Uint8Array to Buffer');
      res.send(Buffer.from(document.fileData));
    } else {
      // For other types, try to convert to Buffer
      console.log('Converting to Buffer');
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
 * Delete a document
 * @route DELETE /api/v1/student/documents/:documentId
 * @access Private (Student)
 */
export const deleteDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { documentId } = req.params;

    // Get user with student information
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

    // Check if document exists and belongs to student
    const document = await prisma.studentDocument.findFirst({
      where: {
        id: documentId,
        studentId
      }
    });

    if (!document) {
      const error = new Error("Document not found");
      error.statusCode = 404;
      throw error;
    }

    // Delete document
    await prisma.studentDocument.delete({
      where: { id: documentId }
    });

    res.status(200).json({
      message: "Document deleted successfully"
    });

  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
}; 