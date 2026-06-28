import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Get supervisor's availabilities
export const getAvailabilities = async (req, res) => {
  try {
    const userId = req.user.id;
    // Find supervisor ID
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
    });
    
    if (!supervisor) {
      return res.status(404).json({ message: 'Supervisor profile not found' });
    }

    const availabilities = await prisma.supervisorAvailability.findMany({
      where: { supervisorId: supervisor.id },
      orderBy: { date: 'asc' },
      include: {
        appointments: {
          include: {
            student: true
          }
        }
      }
    });

    res.status(200).json(availabilities);
  } catch (error) {
    console.error('Error fetching availabilities:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a new availability
export const addAvailability = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date, startTime, endTime, maxStudents, meetingType, location, meetingLink, purpose } = req.body;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
    });

    if (!supervisor) {
      return res.status(404).json({ message: 'Supervisor profile not found' });
    }

    const recurringWeeks = parseInt(req.body.recurringWeeks) || 1;
    const slotsToCreate = [];

    for (let i = 0; i < recurringWeeks; i++) {
      const slotDate = new Date(date);
      // Advance by i weeks
      slotDate.setDate(slotDate.getDate() + (i * 7));

      slotsToCreate.push({
        supervisorId: supervisor.id,
        date: slotDate,
        startTime,
        endTime,
        maxStudents: parseInt(maxStudents) || 1,
        currentBookings: 0,
        isActive: true,
        meetingType: meetingType || 'PHYSICAL',
        location: location || null,
        meetingLink: meetingLink || null,
        purpose: purpose || null,
      });
    }

    const createdCount = await prisma.supervisorAvailability.createMany({
      data: slotsToCreate,
    });

    res.status(201).json({ count: createdCount.count, message: 'Availability added successfully' });
  } catch (error) {
    console.error('Error adding availability:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete/Cancel an availability
export const deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
    });

    // Check if there are bookings
    const availability = await prisma.supervisorAvailability.findUnique({
      where: { id },
      include: { appointments: true }
    });

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }

    if (availability.supervisorId !== supervisor.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // If appointments exist, cancel them instead of deleting the availability
    if (availability.appointments.length > 0) {
      const reason = req.body.reason || 'Cancelled by supervisor';

      await prisma.supervisorAvailability.update({
        where: { id },
        data: { isActive: false },
      });
      // Also cancel the appointments
      await prisma.supervisorAppointment.updateMany({
        where: { availabilityId: id },
        data: { 
          status: 'CANCELLED',
          feedback: reason
        }
      });
      return res.status(200).json({ message: 'Availability and related appointments cancelled' });
    } else {
      await prisma.supervisorAvailability.delete({
        where: { id },
      });
      return res.status(200).json({ message: 'Availability deleted' });
    }
  } catch (error) {
    console.error('Error deleting availability:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get supervisor's appointments
export const getAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
    });

    if (!supervisor) {
      return res.status(404).json({ message: 'Supervisor profile not found' });
    }

    const appointments = await prisma.supervisorAppointment.findMany({
      where: { supervisorId: supervisor.id },
      include: {
        student: true,
        availability: true,
      },
      orderBy: { date: 'asc' },
    });

    res.status(200).json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update appointment status or add feedback
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;
    const userId = req.user.id;

    const supervisor = await prisma.supervisor.findUnique({
      where: { userId },
    });

    const appointment = await prisma.supervisorAppointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.supervisorId !== supervisor.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const updatedAppointment = await prisma.supervisorAppointment.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(feedback && { feedback }),
      },
      include: {
        student: true,
      }
    });

    // If status changed to CANCELLED, we should decrement currentBookings
    if (status === 'CANCELLED' && appointment.status !== 'CANCELLED') {
      await prisma.supervisorAvailability.update({
        where: { id: appointment.availabilityId },
        data: { currentBookings: { decrement: 1 } }
      });
    }

    res.status(200).json(updatedAppointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
