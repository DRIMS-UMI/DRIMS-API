import prisma from "../../../utils/db.mjs";
import { notificationService } from "../../../services/notificationService2.js";

// Utility to generate a unique ticket number
const generateTicketNumber = async () => {
  const count = await prisma.ticket.count();
  return `TKT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
};

// Create a new support ticket
export const createTicket = async (req, res, next) => {
  try {
    const { subject, message, priority, guestName, guestEmail, guestPhone } = req.body;
    let creatorUserId = null;
    let creatorStudentId = null;

    // Determine if the user is authenticated
    if (req.user) {
      if (req.user.isStudentUser) {
        creatorStudentId = req.user.id;
      } else {
        creatorUserId = req.user.id;
      }
    } else if (!guestEmail) {
      const error = new Error("Guest email is required if not logged in");
      error.statusCode = 400;
      throw error;
    }

    const ticketNumber = await generateTicketNumber();

    const newTicket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject,
        priority: priority || "MEDIUM",
        creatorUserId,
        creatorStudentId,
        guestName,
        guestEmail,
        guestPhone,
        messages: {
          create: {
            message: message || "Support ticket created.",
            senderStudentId: creatorStudentId,
            senderAdminId: creatorUserId,
            senderName: creatorUserId || creatorStudentId ? null : guestName || "Guest",
          }
        }
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        creatorUser: { select: { id: true, name: true, email: true, phone: true } },
        creatorStudent: { select: { id: true, fullName: true, email: true, student: { select: { phoneNumber: true } } } },
        messages: {
          include: {
            senderAdmin: { select: { name: true } }
          }
        }
      }
    });

    res.status(201).json({
      message: "Ticket created successfully",
      ticket: newTicket
    });

    const io = req.app.get('io');
    const isSupportOnline = io ? io.isSupportOnline() : false;

    if (isSupportOnline) {
      // Broadcast to admins that a new ticket was created
      io.emit('new_ticket_created', newTicket);
    } else {
      // Fallback: Support is offline, convert to email-based ticket process
      // Notify the user
      const userEmail = guestEmail || (req.user ? req.user.email : null);
      if (userEmail) {
        try {
          await notificationService.sendImmediateNotification({
            type: 'EMAIL',
            title: `Support Ticket Created: ${ticketNumber}`,
            message: `Hello, we have received your support request ("${subject}"). Our support team is currently offline, but we will get back to you via email as soon as possible.`,
            recipientCategory: 'EXTERNAL',
            recipientEmail: userEmail,
            recipientName: guestName || (req.user ? req.user.name : "User")
          });
        } catch (e) {
          console.error("Failed to send offline fallback email to user:", e);
        }
      }

      // Notify superadmins (optional, to let them know a ticket is waiting)
      try {
        const superadmins = await prisma.user.findMany({ where: { role: 'SUPERADMIN' } });
        for (const admin of superadmins) {
          await notificationService.scheduleNotification({
            type: 'EMAIL',
            statusType: 'PENDING',
            title: `New Support Ticket: ${ticketNumber}`,
            message: `A new support ticket was created while the team was offline.\nSubject: ${subject}\nPriority: ${priority}`,
            recipientCategory: 'USER',
            recipientId: admin.id,
            scheduledFor: new Date()
          });
        }
      } catch (e) {
        console.error("Failed to notify superadmins of new offline ticket:", e);
      }
    }

  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

// Get all tickets (for management)
export const getTickets = async (req, res, next) => {
  try {
    const { status, priority, assignedToId } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedToId) filter.assignedToId = assignedToId;

    const tickets = await prisma.ticket.findMany({
      where: filter,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        creatorUser: { select: { id: true, name: true, email: true, phone: true } },
        creatorStudent: { select: { id: true, fullName: true, email: true, student: { select: { phoneNumber: true } } } },
        messages: {
          select: {
            senderAdmin: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({
      message: "Tickets retrieved successfully",
      tickets
    });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

// Get single ticket details
export const getTicketById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        creatorUser: { select: { id: true, name: true, email: true, phone: true } },
        creatorStudent: { select: { id: true, fullName: true, email: true, student: { select: { phoneNumber: true } } } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            senderAdmin: { select: { id: true, name: true } },
            senderStudent: { select: { id: true, fullName: true } }
          }
        }
      }
    });

    if (!ticket) {
      const error = new Error("Ticket not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      message: "Ticket retrieved successfully",
      ticket
    });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

// Update ticket status
export const updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedData = { status };
    if (status === "RESOLVED" || status === "CLOSED") {
      updatedData.resolvedAt = new Date();
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: updatedData
    });

    res.status(200).json({
      message: "Ticket status updated successfully",
      ticket
    });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

// Assign ticket
export const assignTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    const ticket = await prisma.ticket.update({
      where: { id },
      data: { assignedToId }
    });

    res.status(200).json({
      message: "Ticket assigned successfully",
      ticket
    });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};

// Add a message to a ticket
export const addMessageToTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const file = req.file;

    let senderAdminId = null;
    let senderStudentId = null;
    let senderName = "Guest";

    if (req.user) {
      if (req.user.isStudentUser) {
        senderStudentId = req.user.id;
        senderName = req.user.fullName || req.user.name || "Student";
      } else {
        if (req.user.role === 'SUPERADMIN' || req.user.role === 'MANAGER') {
          senderAdminId = req.user.id;
        }
        senderName = req.user.name || "User";
      }
    } else {
      // It's a guest
      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (ticket) senderName = ticket.guestName || "Guest";
    }

    let attachmentUrl = null;
    if (file) {
      // Return the relative URL from public folder, e.g. /uploads/tickets/filename
      attachmentUrl = `/uploads/tickets/${file.filename}`;
    }

    const newMsg = await prisma.ticketMessage.create({
      data: {
        message: message || "",
        attachmentUrl,
        ticketId: id,
        senderAdminId,
        senderStudentId,
        senderName
      }
    });

    res.status(201).json({
      message: "Message added successfully",
      data: newMsg
    });
  } catch (error) {
    if (!error.statusCode) error.statusCode = 500;
    next(error);
  }
};
