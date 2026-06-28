import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get available appointments for a student's assigned supervisors
export const getAvailableAppointments = async (req, res) => {
  try {
    const userId = req.user.id;

    const studentUser = await prisma.studentUser.findFirst({
      where: { id: userId }, // Actually, req.user.id is the studentUser ID based on the system's auth logic
      include: {
        student: {
          include: {
            supervisors: true
          }
        }
      }
    });

    if (!studentUser || !studentUser.student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const supervisorIds = studentUser.student.supervisorIds;

    // Get availabilities that are in the future, active, and not full
    const availabilities = await prisma.supervisorAvailability.findMany({
      where: {
        supervisorId: { in: supervisorIds },
        isActive: true,
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } // From today onwards
      },
      include: {
        supervisor: {
          select: { id: true, name: true, title: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Filter out full slots locally if Prisma schema logic is complex, 
    // but we can just filter in JS easily:
    const availableSlots = availabilities.filter(slot => slot.currentBookings < slot.maxStudents);

    res.status(200).json(availableSlots);
  } catch (error) {
    console.error('Error fetching available appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Book an appointment
export const bookAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { availabilityId, notes } = req.body;

    const studentUser = await prisma.studentUser.findFirst({
      where: { id: userId },
      include: { student: true }
    });

    if (!studentUser || !studentUser.student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const availability = await prisma.supervisorAvailability.findUnique({
      where: { id: availabilityId },
    });

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }

    if (!availability.isActive || availability.currentBookings >= availability.maxStudents) {
      return res.status(400).json({ message: 'This time slot is no longer available' });
    }

    // Check if student already booked for the same day, time, and supervisor
    const existingBooking = await prisma.supervisorAppointment.findFirst({
      where: {
        studentId: studentUser.student.id,
        supervisorId: availability.supervisorId,
        date: availability.date,
        startTime: availability.startTime,
        endTime: availability.endTime,
        status: { notIn: ['CANCELLED'] }
      }
    });

    if (existingBooking) {
      return res.status(400).json({ message: 'You have already booked this slot' });
    }

    // Transaction to safely book and increment currentBookings
    const result = await prisma.$transaction(async (prisma) => {
      const updatedAvailability = await prisma.supervisorAvailability.update({
        where: { 
          id: availabilityId,
          currentBookings: { lt: availability.maxStudents }, // Concurrency check
          isActive: true
        },
        data: { currentBookings: { increment: 1 } }
      });

      const appointment = await prisma.supervisorAppointment.create({
        data: {
          supervisorId: availability.supervisorId,
          studentId: studentUser.student.id,
          availabilityId,
          date: availability.date,
          startTime: availability.startTime,
          endTime: availability.endTime,
          notes,
          status: 'CONFIRMED' // Auto confirmed based on logic
        }
      });

      return appointment;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ message: 'Server error or slot is already full' });
  }
};

// Get student's booked appointments
export const getStudentAppointments = async (req, res) => {
  try {
    const userId = req.user.id;

    const studentUser = await prisma.studentUser.findFirst({
      where: { id: userId },
      include: { student: true }
    });

    if (!studentUser || !studentUser.student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const appointments = await prisma.supervisorAppointment.findMany({
      where: { studentId: studentUser.student.id },
      include: {
        supervisor: {
          select: { id: true, name: true, title: true }
        },
        availability: true
      },
      orderBy: { date: 'asc' }
    });

    res.status(200).json(appointments);
  } catch (error) {
    console.error('Error fetching student appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reschedule an appointment
export const rescheduleAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appointmentId } = req.params;
    const { newAvailabilityId, notes } = req.body;

    const studentUser = await prisma.studentUser.findFirst({
      where: { id: userId },
      include: { student: true }
    });

    if (!studentUser || !studentUser.student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const existingAppointment = await prisma.supervisorAppointment.findUnique({
      where: { id: appointmentId },
    });

    if (!existingAppointment || existingAppointment.studentId !== studentUser.student.id) {
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    if (existingAppointment.status !== 'CONFIRMED') {
      return res.status(400).json({ message: 'Only confirmed appointments can be rescheduled' });
    }

    const newAvailability = await prisma.supervisorAvailability.findUnique({
      where: { id: newAvailabilityId },
    });

    if (!newAvailability) {
      return res.status(404).json({ message: 'New availability not found' });
    }

    if (!newAvailability.isActive || newAvailability.currentBookings >= newAvailability.maxStudents) {
      return res.status(400).json({ message: 'This new time slot is no longer available' });
    }

    // Check if student already booked the new slot
    const existingBooking = await prisma.supervisorAppointment.findFirst({
      where: {
        studentId: studentUser.student.id,
        supervisorId: newAvailability.supervisorId,
        date: newAvailability.date,
        startTime: newAvailability.startTime,
        endTime: newAvailability.endTime,
        status: { notIn: ['CANCELLED'] },
        id: { not: appointmentId } // exclude the current one we are rescheduling
      }
    });

    if (existingBooking) {
      return res.status(400).json({ message: 'You have already booked this slot' });
    }

    // Transaction to safely reschedule
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Decrement old availability
      await prisma.supervisorAvailability.update({
        where: { id: existingAppointment.availabilityId },
        data: { currentBookings: { decrement: 1 } }
      });

      // 2. Increment new availability safely
      await prisma.supervisorAvailability.update({
        where: { 
          id: newAvailabilityId,
          currentBookings: { lt: newAvailability.maxStudents },
          isActive: true
        },
        data: { currentBookings: { increment: 1 } }
      });

      // 3. Update the appointment
      const updatedAppointment = await prisma.supervisorAppointment.update({
        where: { id: appointmentId },
        data: {
          supervisorId: newAvailability.supervisorId,
          availabilityId: newAvailabilityId,
          date: newAvailability.date,
          startTime: newAvailability.startTime,
          endTime: newAvailability.endTime,
          notes: notes !== undefined ? notes : existingAppointment.notes
        }
      });

      return updatedAppointment;
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({ message: 'Server error or new slot is already full' });
  }
};

// Cancel an appointment
export const cancelAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { appointmentId } = req.params;

    const studentUser = await prisma.studentUser.findFirst({
      where: { id: userId },
      include: { student: true }
    });

    if (!studentUser || !studentUser.student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const existingAppointment = await prisma.supervisorAppointment.findUnique({
      where: { id: appointmentId },
    });

    if (!existingAppointment || existingAppointment.studentId !== studentUser.student.id) {
      return res.status(404).json({ message: 'Appointment not found or unauthorized' });
    }

    if (existingAppointment.status === 'CANCELLED') {
      return res.status(400).json({ message: 'Appointment is already cancelled' });
    }

    // Transaction to safely cancel
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Decrement availability
      await prisma.supervisorAvailability.update({
        where: { id: existingAppointment.availabilityId },
        data: { currentBookings: { decrement: 1 } }
      });

      // 2. Update the appointment status
      const updatedAppointment = await prisma.supervisorAppointment.update({
        where: { id: appointmentId },
        data: {
          status: 'CANCELLED',
          feedback: 'Cancelled by student'
        }
      });

      return updatedAppointment;
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
