import { notificationService } from '../../../services/notificationService';

export const scheduleNotification = async (req, res, next) => {
  try {
    const notification = await notificationService.scheduleNotification(req.body);
    res.json(notification);
  } catch (error) {
    next(error);
  }
};

export const cancelNotification = async (req, res, next) => {
  try {
    await notificationService.cancelNotification(req.params.id);
    res.json({ message: 'Notification cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: req.user.id
      },
      orderBy: {
        scheduledFor: 'desc'
      }
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};